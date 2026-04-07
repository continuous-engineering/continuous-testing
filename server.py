"""
Agent Test Manager Server
- API endpoints
- Test management (3-level: global / workspace / agent)
- Tag management
- Run tracking (quick and config-based batch runs)
- Metrics & analytics
- Logs viewer
- Git operations (commit, sync, info, push)

Frontend: static/index.html + static/app.js + static/styles.css

Storage layout (one file per entity):
  workspaces/
    _global/                          # global tests (all projects, all agents)
      _shared/<suite>/<test_id>.yaml
    <project>/
      agents/<agent_id>.yaml          # one file per agent
      _shared/<suite>/<test_id>.yaml  # workspace-level tests
      <agent_id>/<suite>/<test_id>.yaml  # agent-level tests
      results/runs.yaml
      config/environments.yaml
      config/tags.yaml
      config/test_plans.yaml
      logs/
"""

import json
import asyncio
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Dict, List, Any
import subprocess
import uuid
from contextlib import asynccontextmanager

from starlette.applications import Starlette
from starlette.responses import JSONResponse, FileResponse
from starlette.routing import Route, Mount
from starlette.middleware.cors import CORSMiddleware
from starlette.staticfiles import StaticFiles
from starlette.websockets import WebSocket, WebSocketDisconnect
import uvicorn

try:
    import yaml
    YAML_AVAILABLE = True
except:
    YAML_AVAILABLE = False


# ============================================================================
# Configuration
# ============================================================================

BASE_DIR = Path(__file__).parent
WORKSPACES_DIR = BASE_DIR / "workspaces"
STATIC_DIR = BASE_DIR / "static"

WORKSPACES_DIR.mkdir(exist_ok=True)

RESERVED_AGENTS = {'_shared'}       # workspace/global test container
RESERVED_PROJECTS = {'_global'}     # global test workspace


def get_project(request) -> str:
    """Extract active project from X-Project header. Falls back to first real workspace."""
    raw = request.headers.get('X-Project', '').strip()
    if raw and re.match(r'^[a-zA-Z0-9_-]+$', raw):
        return raw
    # Fallback: first non-reserved workspace directory
    for d in sorted(WORKSPACES_DIR.iterdir()):
        if d.is_dir() and not d.name.startswith('_'):
            return d.name
    return 'default'


class WS:
    """Workspace-scoped paths for a project."""
    def __init__(self, project: str):
        self.project = project
        self.root = WORKSPACES_DIR / project
        self.agents_dir = self.root / "agents"      # one .yaml per agent
        self.results = self.root / "results" / "runs.yaml"
        self.environments = self.root / "config" / "environments.yaml"
        self.tags = self.root / "config" / "tags.yaml"
        self.test_plans = self.root / "config" / "test_plans.yaml"
        self.logs = self.root / "logs"
        self.root.mkdir(parents=True, exist_ok=True)

    def agent_file(self, agent_id: str) -> Path:
        """Path to an individual agent YAML file."""
        return self.agents_dir / f"{agent_id}.yaml"

    def suite_dir(self, agent_id: str, suite_type: str) -> Path:
        """Directory holding individual test files for an agent+suite."""
        return self.root / agent_id / suite_type

    def test_file(self, agent_id: str, suite_type: str, test_id: str) -> Path:
        """Path to an individual test YAML file."""
        return self.suite_dir(agent_id, suite_type) / f"{test_id}.yaml"

    def load_all_agents(self) -> List[dict]:
        """Load all real agents from individual files."""
        agents = []
        if self.agents_dir.exists():
            for f in sorted(self.agents_dir.glob("*.yaml")):
                agent = Store.load(f)
                if agent:
                    agents.append(agent)
        return agents


# ============================================================================
# File Store (YAML only)
# ============================================================================

class Store:
    """YAML file-based storage"""

    @staticmethod
    def load(path: Path) -> Dict:
        if not path.exists():
            return {}
        try:
            if YAML_AVAILABLE:
                with open(path, 'r') as f:
                    return yaml.safe_load(f) or {}
            else:
                with open(path, 'r') as f:
                    return json.load(f)
        except Exception as e:
            print(f"Error loading {path}: {e}")
            return {}

    @staticmethod
    def save(path: Path, data: Dict):
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            if YAML_AVAILABLE:
                with open(path, 'w') as f:
                    yaml.dump(data, f, default_flow_style=False)
            else:
                with open(path, 'w') as f:
                    json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving {path}: {e}")


# ============================================================================
# Test collection — 3-level hierarchy
# ============================================================================

def _collect_tests(project: str, agent_id: str, suite_type: str) -> List[dict]:
    """
    Collect tests from all 3 levels in order:
      1. Global    — workspaces/_global/_shared/<suite>/<test_id>.yaml
      2. Workspace — workspaces/<project>/_shared/<suite>/<test_id>.yaml
      3. Agent     — workspaces/<project>/<agent_id>/<suite>/<test_id>.yaml
    Each returned test dict has a '_source' field: 'global' | 'workspace' | 'agent'.
    """
    levels = [
        (WORKSPACES_DIR / "_global" / "_shared" / suite_type, "global"),
        (WORKSPACES_DIR / project / "_shared" / suite_type, "workspace"),
        (WORKSPACES_DIR / project / agent_id / suite_type, "agent"),
    ]
    tests = []
    for directory, source in levels:
        if not directory.exists():
            continue
        for f in sorted(directory.glob("*.yaml")):
            if f.name == "baseline.yaml":
                continue
            test = Store.load(f)
            if test:
                test['_source'] = source
                tests.append(test)
    return tests


def _load_suite_tests(suite_dir: Path) -> List[dict]:
    """Load individual test files from a suite directory."""
    tests = []
    if suite_dir.exists():
        for f in sorted(suite_dir.glob("*.yaml")):
            if f.name == "baseline.yaml":
                continue
            test = Store.load(f)
            if test:
                tests.append(test)
    return tests


# ============================================================================
# Git helpers
# ============================================================================

def _git(args: list) -> subprocess.CompletedProcess:
    """Run a git command in BASE_DIR."""
    return subprocess.run(
        ['git'] + args,
        capture_output=True, text=True,
        cwd=str(BASE_DIR)
    )


# ============================================================================
# API — Project management
# ============================================================================

async def dashboard_page(request):
    """GET / - Main UI"""
    return FileResponse(STATIC_DIR / "index.html")


async def api_list_projects(request):
    """GET /api/projects"""
    projects = []
    for d in sorted(WORKSPACES_DIR.iterdir()):
        if d.is_dir():
            if d.name == '_global':
                label = 'Global Tests'
            else:
                label = d.name.replace('-', ' ').replace('_', ' ').title()
            projects.append({'id': d.name, 'name': label})
    return JSONResponse(projects)


async def api_create_project(request):
    """POST /api/projects"""
    body = await request.json()
    project_id = body.get('id', '').strip().lower()
    if not re.match(r'^[a-z0-9_-]+$', project_id):
        return JSONResponse({'error': 'Invalid project id — use lowercase letters, numbers, hyphens, underscores'}, status_code=400)
    if project_id in ('_global', '_shared'):
        return JSONResponse({'error': 'Reserved project name'}, status_code=400)
    project_dir = WORKSPACES_DIR / project_id
    if project_dir.exists():
        return JSONResponse({'error': 'Project already exists'}, status_code=409)
    project_dir.mkdir(parents=True)
    (project_dir / 'agents').mkdir()
    (project_dir / 'config').mkdir()
    (project_dir / 'results').mkdir()
    (project_dir / 'logs').mkdir()
    return JSONResponse({'id': project_id, 'name': body.get('name', project_id)}, status_code=201)


async def api_delete_project(request):
    """DELETE /api/projects/{project_id}"""
    import shutil
    project_id = request.path_params['project_id']
    if project_id in ('default', '_global'):
        return JSONResponse({'error': f'Cannot delete {project_id}'}, status_code=400)
    project_dir = WORKSPACES_DIR / project_id
    if not project_dir.exists():
        return JSONResponse({'error': 'Project not found'}, status_code=404)
    shutil.rmtree(project_dir)
    return JSONResponse({'deleted': project_id})


# ============================================================================
# API — Dashboard
# ============================================================================

async def api_dashboard(request):
    """GET /api/dashboard - Stats"""
    p = WS(get_project(request))

    agents = p.load_all_agents()
    agent_ids = [a.get('agent_id', '') for a in agents]

    total_tests = functional_tests = security_tests = 0
    for aid in agent_ids + ['_shared']:
        for suite in ['functional', 'security']:
            suite_dir = p.suite_dir(aid, suite)
            if suite_dir.exists():
                count = sum(1 for f in suite_dir.glob("*.yaml") if f.name != "baseline.yaml")
                total_tests += count
                if suite == 'functional':
                    functional_tests += count
                else:
                    security_tests += count

    runs_data = Store.load(p.results)
    runs = runs_data.get('runs', [])
    avg_pass_rate = sum(r.get('pass_rate', 0) for r in runs) / len(runs) if runs else 0
    total_passed = sum(r.get('summary', {}).get('passed', 0) for r in runs)
    total_failed = sum(r.get('summary', {}).get('failed', 0) for r in runs)
    workspaces = sum(1 for d in WORKSPACES_DIR.iterdir() if d.is_dir()) if WORKSPACES_DIR.exists() else 1

    return JSONResponse({
        "agents": len(agents),
        "total_tests": total_tests,
        "functional_tests": functional_tests,
        "security_tests": security_tests,
        "recent_test_runs": len(runs),
        "avg_pass_rate": avg_pass_rate,
        "total_passed": total_passed,
        "total_failed": total_failed,
        "workspaces": workspaces,
    })


# ============================================================================
# API — Agents (one file per agent)
# ============================================================================

async def api_agents(request):
    """GET /api/agents"""
    if get_project(request) == '_global':
        return JSONResponse([])   # _global is test-case library only, no agents
    p = WS(get_project(request))
    agents = []

    for agent in p.load_all_agents():
        agent_id = agent.get('agent_id', '')
        agent['suites'] = {}
        for suite_type in ['functional', 'security']:
            suite_dir = p.suite_dir(agent_id, suite_type)
            if suite_dir.exists():
                count = sum(1 for tf in suite_dir.glob("*.yaml") if tf.name != "baseline.yaml")
                if count:
                    agent['suites'][suite_type] = {'test_count': count}
        agents.append(agent)

    return JSONResponse(agents)


async def api_create_agent(request):
    """POST /api/agents"""
    if get_project(request) == '_global':
        return JSONResponse({'error': 'Agents cannot be created in the Global project.'}, status_code=403)
    p = WS(get_project(request))
    body = await request.json()

    agent_id = f"agent_{uuid.uuid4().hex[:8]}"
    agent = {
        "agent_id": agent_id,
        "name": body.get('name', 'New Agent'),
        "endpoint": body.get('endpoint', ''),
        "model_version": body.get('model_version', 'v1.0'),
        "auth_type": body.get('auth_type', 'none'),
        "auth_value": body.get('auth_value', ''),
        "auth_header": body.get('auth_header', ''),
        "body_template": body.get('body_template', ''),
        "response_path": body.get('response_path', ''),
        "status": "active"
    }

    p.agents_dir.mkdir(parents=True, exist_ok=True)
    Store.save(p.agent_file(agent_id), agent)

    for suite in ['functional', 'security']:
        p.suite_dir(agent_id, suite).mkdir(parents=True, exist_ok=True)

    return JSONResponse(agent, status_code=201)


async def api_update_agent(request):
    """PUT /api/agents/{agent_id}"""
    p = WS(get_project(request))
    agent_id = request.path_params['agent_id']
    if agent_id in RESERVED_AGENTS:
        return JSONResponse({'error': 'Cannot edit reserved agent'}, status_code=400)
    body = await request.json()

    agent_file = p.agent_file(agent_id)
    if not agent_file.exists():
        return JSONResponse({'error': 'Agent not found'}, status_code=404)

    agent = Store.load(agent_file)
    agent.update({
        'name': body.get('name', agent['name']),
        'endpoint': body.get('endpoint', agent['endpoint']),
        'model_version': body.get('model_version', agent['model_version']),
        'auth_type': body.get('auth_type', agent.get('auth_type', 'none')),
        'auth_value': body.get('auth_value', agent.get('auth_value', '')),
        'auth_header': body.get('auth_header', agent.get('auth_header', '')),
        'body_template': body.get('body_template', agent.get('body_template', '')),
        'response_path': body.get('response_path', agent.get('response_path', '')),
    })
    Store.save(agent_file, agent)
    return JSONResponse(agent)


async def api_delete_agent(request):
    """DELETE /api/agents/{agent_id}"""
    import shutil
    p = WS(get_project(request))
    agent_id = request.path_params['agent_id']
    if agent_id in RESERVED_AGENTS:
        return JSONResponse({'error': 'Cannot delete reserved agent'}, status_code=400)

    agent_file = p.agent_file(agent_id)
    if not agent_file.exists():
        return JSONResponse({'error': 'Agent not found'}, status_code=404)
    agent_file.unlink()

    agent_dir = p.root / agent_id
    if agent_dir.exists():
        shutil.rmtree(agent_dir)

    return JSONResponse({'deleted': agent_id})


# ============================================================================
# API — Tests (one file per test)
# ============================================================================

async def api_get_test_cases(request):
    """GET /api/agents/{agent_id}/test-cases/{suite_type}"""
    p = WS(get_project(request))
    agent_id = request.path_params['agent_id']
    suite_type = request.path_params['suite_type']
    tests = _load_suite_tests(p.suite_dir(agent_id, suite_type))
    return JSONResponse(tests)


async def api_create_test_case(request):
    """POST /api/agents/{agent_id}/test-cases/{suite_type}"""
    p = WS(get_project(request))
    agent_id = request.path_params['agent_id']
    suite_type = request.path_params['suite_type']
    body = await request.json()

    test_id = (body.get('test_id') or f"test_{uuid.uuid4().hex[:8]}").strip()
    test_id = re.sub(r'[^\w-]', '_', test_id)  # safe for filename

    test = {
        "test_id": test_id,
        "test_name": body.get('test_name', ''),
        "user_prompt": body.get('user_prompt', ''),
        "expected_response": body.get('expected_response', ''),
        "expected_latency_ms": body.get('expected_latency_ms', 5000),
        "min_semantic_match": body.get('min_semantic_match', 0.75),
        "category": body.get('category', ''),
        "priority": body.get('priority', 'medium'),
        "tags": body.get('tags', [])
    }

    suite_dir = p.suite_dir(agent_id, suite_type)
    suite_dir.mkdir(parents=True, exist_ok=True)
    Store.save(p.test_file(agent_id, suite_type, test_id), test)
    return JSONResponse(test, status_code=201)


async def api_delete_test_case(request):
    """DELETE /api/agents/{agent_id}/test-cases/{suite_type}/{test_id}"""
    p = WS(get_project(request))
    agent_id = request.path_params['agent_id']
    suite_type = request.path_params['suite_type']
    test_id = request.path_params['test_id']

    test_file = p.test_file(agent_id, suite_type, test_id)
    if test_file.exists():
        test_file.unlink()
    return JSONResponse({'deleted': test_id})


# ============================================================================
# API — Tests (cross-scope: global + workspace + agent-specific)
# ============================================================================

def _find_test_case_file(project: str, test_id: str):
    """Search all 3 levels for a test by ID. Returns (Path, dict) or (None, {})."""
    p = WS(project)
    candidates = [
        WORKSPACES_DIR / '_global' / '_shared',
        WORKSPACES_DIR / project / '_shared',
    ]
    for agent in p.load_all_agents():
        candidates.append(p.root / agent['agent_id'])

    for base in candidates:
        for suite in ['functional', 'security']:
            f = base / suite / f'{test_id}.yaml'
            if f.exists():
                return f, Store.load(f)
    return None, {}


async def api_list_test_cases(request):
    """GET /api/test-cases — list all visible tests with optional filters"""
    project = get_project(request)
    suite_filter   = request.query_params.get('suite_type', '')
    tag_filter     = request.query_params.get('tag', '')
    cat_filter     = request.query_params.get('category', '')
    scope_filter   = request.query_params.get('scope', '')
    agent_filter   = request.query_params.get('agent_id', '')

    suite_types = [suite_filter] if suite_filter else ['functional', 'security']
    tag_set = set(t.strip() for t in tag_filter.split(',') if t.strip()) if tag_filter else None

    tests = []
    p = WS(project)

    for st in suite_types:
        # 1. Global
        if not scope_filter or scope_filter == 'global':
            d = WORKSPACES_DIR / '_global' / '_shared' / st
            if d.exists():
                for f in sorted(d.glob('*.yaml')):
                    if f.name == 'baseline.yaml':
                        continue
                    t = Store.load(f)
                    if t:
                        t['_source'] = 'global'
                        t['suite_type'] = st
                        tests.append(t)

        # 2. Workspace
        if not scope_filter or scope_filter == 'workspace':
            d = WORKSPACES_DIR / project / '_shared' / st
            if d.exists():
                for f in sorted(d.glob('*.yaml')):
                    if f.name == 'baseline.yaml':
                        continue
                    t = Store.load(f)
                    if t:
                        t['_source'] = 'workspace'
                        t['suite_type'] = st
                        tests.append(t)

        # 3. Agent-specific
        if not scope_filter or scope_filter == 'agent':
            agents = p.load_all_agents()
            if agent_filter:
                agents = [a for a in agents if a['agent_id'] == agent_filter]
            for agent in agents:
                d = p.suite_dir(agent['agent_id'], st)
                if d.exists():
                    for f in sorted(d.glob('*.yaml')):
                        if f.name == 'baseline.yaml':
                            continue
                        t = Store.load(f)
                        if t:
                            t['_source'] = 'agent'
                            t['_agent_id'] = agent['agent_id']
                            t['_agent_name'] = agent.get('name', agent['agent_id'])
                            t['suite_type'] = st
                            tests.append(t)

    if tag_set:
        tests = [t for t in tests if tag_set.intersection(set(t.get('tags', [])))]
    if cat_filter:
        tests = [t for t in tests if t.get('category', '') == cat_filter]

    return JSONResponse(tests)


async def api_get_test_case(request):
    """GET /api/test-cases/{test_id}"""
    project = get_project(request)
    test_id = request.path_params['test_id']
    _, test = _find_test_case_file(project, test_id)
    if not test:
        return JSONResponse({'error': 'Test not found'}, status_code=404)
    return JSONResponse(test)


async def api_save_test_case(request):
    """POST /api/test-cases — create or overwrite a test at the specified scope"""
    project = get_project(request)
    body = await request.json()

    scope      = body.get('scope', 'global')    # global | workspace | agent
    suite_type = body.get('suite_type', 'functional')
    agent_id   = body.get('agent_id', '')
    editing_id = body.get('editing_id', '')     # previous test_id if renaming

    # Global scope is only writable from the _global project
    if scope == 'global' and project != '_global':
        return JSONResponse(
            {'error': 'Global test cases can only be created or edited from the Global project.'},
            status_code=403
        )

    test_id = (body.get('test_id') or f'test_{uuid.uuid4().hex[:8]}').strip()
    test_id = re.sub(r'[^\w-]', '_', test_id)

    if scope == 'global':
        target_dir = WORKSPACES_DIR / '_global' / '_shared' / suite_type
    elif scope == 'workspace':
        target_dir = WORKSPACES_DIR / project / '_shared' / suite_type
    elif scope == 'agent' and agent_id:
        target_dir = WS(project).suite_dir(agent_id, suite_type)
    else:
        target_dir = WORKSPACES_DIR / project / '_shared' / suite_type

    target_dir.mkdir(parents=True, exist_ok=True)

    test = {
        'test_id': test_id,
        'test_name': body.get('test_name', ''),
        'user_prompt': body.get('user_prompt', ''),
        'expected_response': body.get('expected_response', ''),
        'expected_latency_ms': body.get('expected_latency_ms', 5000),
        'min_semantic_match': body.get('min_semantic_match', 0.75),
        'category': body.get('category', ''),
        'priority': body.get('priority', 'medium'),
        'tags': body.get('tags', []),
    }

    # Remove old file if test_id was renamed
    if editing_id and editing_id != test_id:
        old_file, _ = _find_test_case_file(project, editing_id)
        if old_file and old_file.exists():
            old_file.unlink()

    Store.save(target_dir / f'{test_id}.yaml', test)
    return JSONResponse(test, status_code=201)


async def api_delete_test_case_global(request):
    """DELETE /api/test-cases/{test_id}"""
    project = get_project(request)
    test_id = request.path_params['test_id']
    test_file, test_data = _find_test_case_file(project, test_id)
    if not test_file:
        return JSONResponse({'error': 'Test not found'}, status_code=404)

    # Determine scope from file path — global tests live under _global/
    try:
        rel = test_file.relative_to(WORKSPACES_DIR)
        is_global = rel.parts[0] == '_global'
    except Exception:
        is_global = False

    if is_global and project != '_global':
        return JSONResponse(
            {'error': 'Global test cases can only be deleted from the Global project.'},
            status_code=403
        )

    test_file.unlink()
    return JSONResponse({'deleted': test_id})


# ============================================================================
# Agent execution helpers
# ============================================================================

def _build_auth_headers(agent: dict) -> dict:
    """Build Authorization/API-key headers from agent auth config."""
    import base64
    auth_type = agent.get('auth_type', 'none')
    auth_value = agent.get('auth_value', '').strip()
    auth_header = agent.get('auth_header', '').strip()
    if auth_type == 'bearer' and auth_value:
        return {'Authorization': f'Bearer {auth_value}'}
    if auth_type == 'basic' and auth_value:
        encoded = base64.b64encode(auth_value.encode()).decode()
        return {'Authorization': f'Basic {encoded}'}
    if auth_type == 'api_key' and auth_value:
        header_name = auth_header or 'X-API-Key'
        return {header_name: auth_value}
    return {}


DEFAULT_BODY_TEMPLATE = '{"messages": [{"role": "user", "content": "{{message}}"}]}'


def _build_request_body(prompt: str, body_template: str) -> bytes:
    """Build the HTTP request body from a template, substituting {{message}} with the prompt.

    Supports both forms:
      "query": "{{message}}"   — placeholder inside quotes in the template
      "query": {{message}}     — placeholder without quotes (quotes are added automatically)

    Both produce the same valid JSON output.
    """
    template = (body_template or DEFAULT_BODY_TEMPLATE).strip()
    # json.dumps(prompt) gives a properly escaped, quoted JSON string e.g. '"hello \\"world\\""'
    json_str = json.dumps(prompt)
    # Match either: "{{message}}" or {{message}} — both replaced with the full quoted json_str
    body_str = re.sub(r'"?\{\{\s*message\s*\}\}"?', json_str, template)
    try:
        json.loads(body_str)
        return body_str.encode('utf-8')
    except json.JSONDecodeError:
        return json.dumps({"messages": [{"role": "user", "content": prompt}]}).encode('utf-8')


def _walk_path(obj: Any, path: str) -> Any:
    """Walk a dot-notation path through a nested dict/list. Returns None if not found.
    Supports: msg  /  data.response  /  choices.0.message.content
    """
    for key in path.split('.'):
        if obj is None:
            return None
        if isinstance(obj, list):
            try:
                obj = obj[int(key)]
            except (ValueError, IndexError):
                return None
        elif isinstance(obj, dict):
            obj = obj.get(key)
        else:
            return None
    return obj


def _extract_response_text(raw: str, response_path: str = '') -> str:
    """Extract the agent's reply text from a JSON response.
    If response_path is set, use it directly (dot-notation).
    Otherwise fall back to trying common fields.
    """
    try:
        parsed = json.loads(raw)
    except Exception:
        return raw

    # User-defined path takes priority
    if response_path:
        val = _walk_path(parsed, response_path.strip())
        if val is not None:
            if isinstance(val, str):
                return val
            return json.dumps(val, indent=2)   # non-string (object/array) — pretty-print it

    # Auto-detect: OpenAI Chat Completions
    choices = parsed.get('choices')
    if choices and isinstance(choices, list) and choices:
        msg = choices[0].get('message', {})
        if isinstance(msg, dict) and msg.get('content'):
            return msg['content']
        if choices[0].get('text'):
            return choices[0]['text']

    # Common single-field responses
    for field in ('response', 'message', 'content', 'answer', 'output', 'text', 'result', 'reply'):
        val = parsed.get(field)
        if val and isinstance(val, str):
            return val

    # Nested: {"data": {"response": "..."}} etc.
    for wrapper in ('data', 'result', 'output'):
        nested = parsed.get(wrapper)
        if isinstance(nested, dict):
            for field in ('response', 'message', 'content', 'text', 'answer'):
                val = nested.get(field)
                if val and isinstance(val, str):
                    return val

    return raw


def _call_agent_sync(endpoint: str, prompt: str, extra_headers: dict = None, body_template: str = None, response_path: str = ''):
    """Blocking HTTP call to an agent. Returns (response_text, raw, elapsed_ms, error)."""
    import urllib.request as urlreq
    import urllib.error

    target = endpoint.rstrip('/')

    payload = _build_request_body(prompt, body_template)
    headers = {'Content-Type': 'application/json'}
    if extra_headers:
        headers.update(extra_headers)
    start = datetime.utcnow()

    try:
        req = urlreq.Request(target, data=payload, headers=headers, method='POST')
        with urlreq.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode('utf-8', errors='replace')
        elapsed_ms = (datetime.utcnow() - start).total_seconds() * 1000
        text = _extract_response_text(raw, response_path)
        return text, raw, elapsed_ms, None
    except urllib.error.HTTPError as e:
        elapsed_ms = (datetime.utcnow() - start).total_seconds() * 1000
        err = f'HTTP {e.code}: {e.read().decode("utf-8", errors="replace")[:400]}'
        return '', '', elapsed_ms, err
    except Exception as e:
        elapsed_ms = (datetime.utcnow() - start).total_seconds() * 1000
        return '', '', elapsed_ms, str(e)


def _keyword_score(expected: str, actual: str) -> float:
    """Word-overlap score between expected and actual response (0.0 - 1.0)."""
    if not expected:
        return 1.0
    if not actual:
        return 0.0
    exp_words = set(w.lower() for w in re.findall(r'\b\w{4,}\b', expected))
    if not exp_words:
        return 1.0
    act_words = set(w.lower() for w in re.findall(r'\b\w{4,}\b', actual))
    return len(exp_words & act_words) / len(exp_words)


def _execute_test(agent: dict, test: dict) -> dict:
    """Run a single test against an agent (blocking — call via asyncio.to_thread)."""
    endpoint = agent.get('endpoint', '').strip()
    prompt = test.get('user_prompt', '')
    expected = test.get('expected_response', '')
    source = test.get('_source', 'agent')

    if not endpoint:
        return {
            'test_id': test.get('test_id'),
            'test_name': test.get('test_name', ''),
            'status': 'error',
            'error': 'No endpoint configured',
            'score': 0.0,
            'latency_ms': 0,
            'actual_response': '',
            'expected_response': expected,
            '_source': source,
        }

    text, _raw, elapsed_ms, error = _call_agent_sync(
        endpoint, prompt,
        extra_headers=_build_auth_headers(agent),
        body_template=agent.get('body_template'),
        response_path=agent.get('response_path', '')
    )

    if error:
        return {
            'test_id': test.get('test_id'),
            'test_name': test.get('test_name', ''),
            'status': 'error',
            'error': error,
            'score': 0.0,
            'latency_ms': round(elapsed_ms, 1),
            'actual_response': '',
            'expected_response': expected,
            '_source': source,
        }

    score = _keyword_score(expected, text)
    latency_ok = elapsed_ms <= test.get('expected_latency_ms', 5000)
    passed = score >= test.get('min_semantic_match', 0.75) and latency_ok

    return {
        'test_id': test.get('test_id'),
        'test_name': test.get('test_name', ''),
        'status': 'pass' if passed else 'fail',
        'score': round(score, 3),
        'latency_ms': round(elapsed_ms, 1),
        'latency_ok': latency_ok,
        'actual_response': text[:1500],
        'expected_response': expected,
        '_source': source,
    }


async def api_probe(request):
    """POST /api/probe - send a prompt to an agent endpoint and return raw response"""
    p = WS(get_project(request))
    body = await request.json()
    agent_id = body.get('agent_id', '')
    prompt = body.get('prompt', '')

    agent_file = p.agent_file(agent_id)
    if not agent_file.exists():
        return JSONResponse({'error': f'Agent {agent_id} not found'}, status_code=404)
    agent = Store.load(agent_file)

    endpoint = agent.get('endpoint', '').strip()
    if not endpoint:
        return JSONResponse({'error': 'Agent has no endpoint configured'}, status_code=400)

    text, raw, _elapsed, error = await asyncio.to_thread(
        _call_agent_sync, endpoint, prompt,
        _build_auth_headers(agent), agent.get('body_template'), agent.get('response_path', '')
    )
    if error:
        return JSONResponse({'error': error})
    return JSONResponse({'response': text, 'raw': raw})


# ============================================================================
# API — Profiles & Tags
# ============================================================================

async def api_environments(request):
    """GET /api/environments"""
    p = WS(get_project(request))
    data = Store.load(p.environments)
    return JSONResponse(data.get('profiles', []))


async def api_create_environment(request):
    """POST /api/environments"""
    p = WS(get_project(request))
    body = await request.json()
    data = Store.load(p.environments)
    if 'profiles' not in data:
        data['profiles'] = []
    profile = {
        'id': uuid.uuid4().hex[:8],
        'name': body.get('name', 'New Environment'),
        'variables': body.get('variables', {})
    }
    data['profiles'].append(profile)
    Store.save(p.environments, data)
    return JSONResponse(profile, status_code=201)


async def api_update_environment(request):
    """PUT /api/environments/{env_id}"""
    ws = WS(get_project(request))
    env_id = request.path_params['env_id']
    body = await request.json()
    data = Store.load(ws.environments)
    profiles = data.get('profiles', [])
    idx = next((i for i, p in enumerate(profiles) if p['id'] == env_id), -1)
    if idx < 0:
        return JSONResponse({'error': 'Not found'}, status_code=404)
    profiles[idx].update({'name': body.get('name', profiles[idx]['name']), 'variables': body.get('variables', {})})
    Store.save(ws.environments, data)
    return JSONResponse(profiles[idx])


async def api_delete_environment(request):
    """DELETE /api/environments/{env_id}"""
    p = WS(get_project(request))
    env_id = request.path_params['env_id']
    data = Store.load(p.environments)
    data['profiles'] = [x for x in data.get('profiles', []) if x['id'] != env_id]
    Store.save(p.environments, data)
    return JSONResponse({'deleted': env_id})


async def api_tags(request):
    """GET/POST /api/tags"""
    p = WS(get_project(request))
    data = Store.load(p.tags)

    if request.method == "GET":
        return JSONResponse(data.get('tags', []))

    body = await request.json()
    if 'tags' not in data:
        data['tags'] = []
    tag = {
        "id": uuid.uuid4().hex[:8],
        "name": body.get('name'),
        "color": body.get('color', '#3498db')
    }
    data['tags'].append(tag)
    Store.save(p.tags, data)
    return JSONResponse(tag, status_code=201)


# ============================================================================
# API — Git operations
# ============================================================================

async def api_git_status(request):
    """GET /api/git/status - changed files scoped to active workspace"""
    p = WS(get_project(request))
    rel = str(p.root.relative_to(BASE_DIR))
    result = _git(['status', '--short', rel])
    output = (result.stdout + result.stderr).strip() or 'Nothing to commit'

    # Also report overall dirty state (any uncommitted changes anywhere)
    overall = _git(['status', '--short'])
    dirty = bool(overall.stdout.strip())

    return JSONResponse({'output': output, 'dirty': dirty})


async def api_git_info(request):
    """GET /api/git/info - branch, ahead/behind, last sync"""
    branch_result = _git(['rev-parse', '--abbrev-ref', 'HEAD'])
    branch = branch_result.stdout.strip() or 'unknown'

    ahead = behind = 0
    remote_result = _git(['rev-list', '--left-right', '--count', f'HEAD...origin/{branch}'])
    if remote_result.returncode == 0:
        parts = remote_result.stdout.strip().split()
        if len(parts) == 2:
            try:
                ahead, behind = int(parts[0]), int(parts[1])
            except ValueError:
                pass

    fetch_result = _git(['log', '-1', '--format=%cd', '--date=iso', 'FETCH_HEAD'])
    last_sync = fetch_result.stdout.strip() or None

    status_result = _git(['status', '--short'])
    dirty = bool(status_result.stdout.strip())

    return JSONResponse({
        'branch': branch,
        'ahead': ahead,
        'behind': behind,
        'dirty': dirty,
        'last_sync': last_sync,
    })


async def api_git_commit(request):
    """POST /api/git/commit - stage workspace files (excluding results/logs) and commit"""
    p = WS(get_project(request))
    body = await request.json()
    message = body.get('message', '').strip()
    if not message:
        return JSONResponse({'success': False, 'output': 'No commit message'}, status_code=400)

    # Stage only agents/ and test dirs (not results/ or logs/)
    rel = str(p.root.relative_to(BASE_DIR))
    add_result = _git(['add', rel])
    if add_result.returncode != 0:
        return JSONResponse({'success': False, 'output': add_result.stderr or 'git add failed'})

    # Unstage results/ and logs/ if they were caught
    _git(['reset', 'HEAD', '--', f'{rel}/results'])
    _git(['reset', 'HEAD', '--', f'{rel}/logs'])

    commit_result = _git(['commit', '-m', message])
    output = (commit_result.stdout + commit_result.stderr).strip()
    success = commit_result.returncode == 0

    # Return updated dirty state
    status_result = _git(['status', '--short'])
    dirty = bool(status_result.stdout.strip())

    return JSONResponse({'success': success, 'output': output, 'dirty': dirty})


async def api_git_sync(request):
    """POST /api/git/sync - fetch + rebase onto tracking branch.
    On conflict: aborts automatically, returns conflict file list.
    """
    fetch = _git(['fetch', '--all'])

    branch_result = _git(['rev-parse', '--abbrev-ref', 'HEAD'])
    branch = branch_result.stdout.strip() or 'main'
    tracking = f'origin/{branch}'

    remote_check = _git(['rev-parse', '--verify', tracking])
    if remote_check.returncode != 0:
        return JSONResponse({
            'success': True,
            'output': f'No remote branch {tracking} yet — nothing to sync',
            'conflicts': [],
            'dirty': False,
        })

    rebase = _git(['rebase', tracking])

    if rebase.returncode == 0:
        status_result = _git(['status', '--short'])
        dirty = bool(status_result.stdout.strip())
        return JSONResponse({
            'success': True,
            'output': (rebase.stdout + rebase.stderr).strip() or 'Up to date',
            'conflicts': [],
            'dirty': dirty,
        })

    # Conflict — collect files then abort to keep repo clean
    conflicts_result = _git(['diff', '--name-only', '--diff-filter=U'])
    conflicts = [f.strip() for f in conflicts_result.stdout.splitlines() if f.strip()]
    _git(['rebase', '--abort'])

    return JSONResponse({
        'success': False,
        'output': (rebase.stdout + rebase.stderr).strip(),
        'conflicts': conflicts,
        'dirty': True,
    })


async def api_git_push(request):
    """POST /api/git/push - push current branch to origin"""
    branch_result = _git(['rev-parse', '--abbrev-ref', 'HEAD'])
    branch = branch_result.stdout.strip() or 'main'
    push = _git(['push', 'origin', branch])
    output = (push.stdout + push.stderr).strip()
    return JSONResponse({'success': push.returncode == 0, 'output': output, 'branch': branch})


async def api_git_smart_commit(request):
    """POST /api/git/smart-commit
    Groups changed workspace files by scope, creates one commit per scope,
    then rebases onto the tracking branch and pushes.

    Commit groups (in order):
      1. workspaces/_global/     → "test(global): <message>"
      2. workspaces/<p>/agents/  → "feat(<p>): update agents"
      3. workspaces/<p>/_shared/ → "test(<p>): workspace-level tests"
      4. workspaces/<p>/<agent>/ → "test(<p>/<agent>): agent tests"

    The user-supplied message is appended to each commit's subject.
    results/ and logs/ are always excluded.
    """
    body = await request.json()
    message = body.get('message', '').strip() or 'update'

    # Get changed files (untracked + modified, excluding gitignored)
    status = _git(['status', '--short', '--', 'workspaces/'])
    if status.returncode != 0:
        return JSONResponse({'success': False, 'output': status.stderr, 'commits': []})

    # Parse changed paths
    changed_files: List[str] = []
    for line in status.stdout.splitlines():
        parts = line.strip().split(None, 1)
        if len(parts) == 2:
            path = parts[1].strip().strip('"')
            # Exclude results/ and logs/
            if '/results/' not in path and '/logs/' not in path:
                changed_files.append(path)

    if not changed_files:
        return JSONResponse({'success': True, 'output': 'Nothing to commit', 'commits': []})

    # Group by scope
    groups: Dict[str, List[str]] = {}
    for path in changed_files:
        parts = path.split('/')
        # parts[0] = 'workspaces', parts[1] = project, parts[2+] = rest
        if len(parts) < 3:
            continue
        proj = parts[1]
        rest = parts[2] if len(parts) > 2 else ''

        if proj == '_global':
            key = ('_global', '_global', '')
        elif rest == 'agents' or (len(parts) > 3 and parts[2] == 'agents'):
            key = ('agents', proj, '')
        elif rest == '_shared':
            key = ('workspace', proj, '')
        elif rest and not rest.startswith('results') and not rest.startswith('logs') and rest != 'config':
            agent_id = rest
            key = ('agent', proj, agent_id)
        else:
            key = ('config', proj, '')

        groups.setdefault(key, []).append(path)

    commits = []
    log_output = []

    for (scope, proj, agent_id), files in groups.items():
        # Build commit subject
        if scope == '_global':
            subject = f'test(global): {message}'
        elif scope == 'agents':
            subject = f'feat({proj}): {message} [agents]'
        elif scope == 'workspace':
            subject = f'test({proj}): {message} [workspace]'
        elif scope == 'agent':
            subject = f'test({proj}/{agent_id}): {message}'
        else:
            subject = f'chore({proj}): {message}'

        # Stage only these files
        for f in files:
            _git(['add', f])

        commit = _git(['commit', '-m', subject])
        log_output.append(f'--- {subject} ---')
        log_output.append((commit.stdout + commit.stderr).strip())
        commits.append({'subject': subject, 'success': commit.returncode == 0, 'files': len(files)})

        if commit.returncode != 0:
            break  # stop on first failure

    all_ok = all(c['success'] for c in commits)

    # Rebase + push if all commits succeeded
    push_output = ''
    pushed = False
    if all_ok and commits:
        branch_result = _git(['rev-parse', '--abbrev-ref', 'HEAD'])
        branch = branch_result.stdout.strip() or 'main'
        tracking = f'origin/{branch}'

        remote_check = _git(['rev-parse', '--verify', tracking])
        if remote_check.returncode == 0:
            rebase = _git(['rebase', tracking])
            if rebase.returncode != 0:
                conflicts_result = _git(['diff', '--name-only', '--diff-filter=U'])
                conflicts = [f.strip() for f in conflicts_result.stdout.splitlines() if f.strip()]
                _git(['rebase', '--abort'])
                return JSONResponse({
                    'success': False,
                    'output': '\n'.join(log_output) + '\n\nRebase conflict — aborted. Files safe.',
                    'commits': commits,
                    'conflicts': conflicts,
                })
            push = _git(['push', 'origin', branch])
            push_output = (push.stdout + push.stderr).strip()
            pushed = push.returncode == 0

    status_result = _git(['status', '--short'])
    dirty = bool(status_result.stdout.strip())

    return JSONResponse({
        'success': all_ok,
        'output': '\n'.join(log_output) + (f'\n\n--- push ---\n{push_output}' if push_output else ''),
        'commits': commits,
        'pushed': pushed,
        'dirty': dirty,
    })


# ============================================================================
# API — Test plans
# ============================================================================

async def api_test_plans(request):
    """GET /api/test-plans"""
    p = WS(get_project(request))
    data = Store.load(p.test_plans)
    return JSONResponse(data.get('run_configs', []))


async def api_create_test_plan(request):
    """POST /api/test-plans"""
    p = WS(get_project(request))
    body = await request.json()
    config = {
        'config_id': f'rc_{uuid.uuid4().hex[:8]}',
        'name': body.get('name', 'New Test Plan'),
        'agent_ids': body.get('agent_ids', []),
        'suite_types': body.get('suite_types', ['functional']),
        'tags': body.get('tags', []),
        'created_at': datetime.utcnow().isoformat(),
    }
    data = Store.load(p.test_plans)
    if 'run_configs' not in data:
        data['run_configs'] = []
    data['run_configs'].append(config)
    Store.save(p.test_plans, data)
    return JSONResponse(config, status_code=201)


async def api_update_test_plan(request):
    """PUT /api/test-plans/{plan_id}"""
    p = WS(get_project(request))
    plan_id = request.path_params['plan_id']
    body = await request.json()
    data = Store.load(p.test_plans)
    configs = data.get('run_configs', [])
    idx = next((i for i, c in enumerate(configs) if c['config_id'] == plan_id), None)
    if idx is None:
        return JSONResponse({'error': 'Test plan not found'}, status_code=404)
    configs[idx].update({
        'name': body.get('name', configs[idx]['name']),
        'agent_ids': body.get('agent_ids', configs[idx]['agent_ids']),
        'suite_types': body.get('suite_types', configs[idx]['suite_types']),
        'tags': body.get('tags', configs[idx]['tags']),
    })
    Store.save(p.test_plans, data)
    return JSONResponse(configs[idx])


async def api_delete_test_plan(request):
    """DELETE /api/test-plans/{plan_id}"""
    p = WS(get_project(request))
    plan_id = request.path_params['plan_id']
    data = Store.load(p.test_plans)
    data['run_configs'] = [c for c in data.get('run_configs', []) if c['config_id'] != plan_id]
    Store.save(p.test_plans, data)
    return JSONResponse({'deleted': plan_id})


# ============================================================================
# API — Runs
# ============================================================================

def _build_run_record(agent: dict, suite_type: str, tests: list, config_id=None, config_name=None) -> dict:
    """Execute tests and return a completed run record."""
    run_id = uuid.uuid4().hex[:12]
    started_at = datetime.utcnow().isoformat()
    results = [_execute_test(agent, test) for test in tests]
    ended_at = datetime.utcnow().isoformat()
    duration = (datetime.fromisoformat(ended_at) - datetime.fromisoformat(started_at)).total_seconds()
    passed = sum(1 for r in results if r['status'] == 'pass')
    failed = sum(1 for r in results if r['status'] == 'fail')
    errors = sum(1 for r in results if r['status'] == 'error')
    run = {
        'run_id': run_id,
        'agent_id': agent['agent_id'],
        'agent_name': agent.get('name', agent['agent_id']),
        'suite_type': suite_type,
        'status': 'completed',
        'started_at': started_at,
        'ended_at': ended_at,
        'duration_seconds': round(duration, 2),
        'summary': {'passed': passed, 'failed': failed, 'errors': errors, 'total': len(results)},
        'pass_rate': round(passed / len(results), 3) if results else 0,
        'results': results,
    }
    if config_id:
        run['config_id'] = config_id
        run['config_name'] = config_name or ''
    return run


async def api_test_runs(request):
    """GET /api/test-runs"""
    p = WS(get_project(request))
    limit = int(request.query_params.get('limit', 50))
    agent_filter = request.query_params.get('agent_id', '')

    data = Store.load(p.results)
    runs = data.get('runs', [])

    if agent_filter:
        runs = [r for r in runs if r.get('agent_id') == agent_filter]

    summary_runs = [
        {k: v for k, v in r.items() if k != 'results'}
        for r in runs[-limit:]
    ]
    return JSONResponse(summary_runs)


async def api_get_test_run(request):
    """GET /api/test-runs/{run_id} - full run detail including per-test results"""
    p = WS(get_project(request))
    run_id = request.path_params['run_id']

    data = Store.load(p.results)
    run = next((r for r in data.get('runs', []) if r.get('run_id') == run_id), None)
    if not run:
        return JSONResponse({'error': 'Run not found'}, status_code=404)
    return JSONResponse(run)


async def api_start_test_run(request):
    """POST /api/test-runs - start a new test run (config-based or quick single-agent)"""
    p = WS(get_project(request))
    body = await request.json()
    config_id = body.get('config_id')

    if config_id:
        # Config-based batch run
        configs_data = Store.load(p.test_plans)
        config = next((c for c in configs_data.get('run_configs', []) if c['config_id'] == config_id), None)
        if not config:
            return JSONResponse({'error': f'Run config {config_id} not found'}, status_code=404)

        all_agents = p.load_all_agents()
        agent_ids = config.get('agent_ids', [])
        target_agents = [a for a in all_agents if a['agent_id'] in agent_ids] if agent_ids else all_agents
        if not target_agents:
            return JSONResponse({'error': 'No agents found for this config'}, status_code=400)

        suite_types = config.get('suite_types', ['functional'])
        tag_filter = set(config.get('tags', []))

        stored_runs = []
        data = Store.load(p.results)
        if 'runs' not in data:
            data['runs'] = []

        for agent in target_agents:
            for suite_type in suite_types:
                # Collect from all 3 levels
                tests = _collect_tests(p.project, agent['agent_id'], suite_type)
                if tag_filter:
                    tests = [t for t in tests if tag_filter.intersection(set(t.get('tags', [])))]
                if not tests:
                    continue
                run = await asyncio.to_thread(
                    _build_run_record, agent, suite_type, tests, config_id, config.get('name')
                )
                data['runs'].append(run)
                stored_runs.append({k: v for k, v in run.items() if k != 'results'})

        Store.save(p.results, data)

        total_p = sum(r['summary']['passed'] for r in stored_runs)
        total_f = sum(r['summary']['failed'] for r in stored_runs)
        total_e = sum(r['summary']['errors'] for r in stored_runs)
        total   = sum(r['summary']['total']  for r in stored_runs)

        return JSONResponse({
            'batch': True,
            'config_id': config_id,
            'config_name': config.get('name', ''),
            'runs': stored_runs,
            'total_summary': {
                'passed': total_p, 'failed': total_f, 'errors': total_e,
                'total': total, 'run_count': len(stored_runs)
            },
        }, status_code=201)

    else:
        # Quick run — single agent, collects from all 3 levels
        agent_id = body.get('agent_id', '')
        suite_type = body.get('suite_type', 'functional')

        agent_file = p.agent_file(agent_id)
        if not agent_file.exists():
            return JSONResponse({'error': f'Agent {agent_id} not found'}, status_code=404)
        agent = Store.load(agent_file)

        tests = _collect_tests(p.project, agent_id, suite_type)
        if not tests:
            return JSONResponse({'error': f'No tests at any level for {agent_id} / {suite_type}'}, status_code=400)

        run = await asyncio.to_thread(_build_run_record, agent, suite_type, tests)

        data = Store.load(p.results)
        if 'runs' not in data:
            data['runs'] = []
        data['runs'].append(run)
        Store.save(p.results, data)

        return JSONResponse({k: v for k, v in run.items() if k != 'results'}, status_code=201)


# ============================================================================
# API — Logs
# ============================================================================

async def api_logs(request):
    """GET /api/logs/{log_type}"""
    p = WS(get_project(request))
    log_type = request.path_params['log_type']
    log_file = p.logs / f"{log_type}.log"
    content = log_file.read_text() if log_file.exists() else "No logs"
    return JSONResponse({"content": content})


async def api_clear_logs(request):
    """DELETE /api/logs/{log_type}"""
    p = WS(get_project(request))
    log_type = request.path_params['log_type']
    log_file = p.logs / f"{log_type}.log"
    if log_file.exists():
        log_file.unlink()
    return JSONResponse({"status": "cleared"})


# ============================================================================
# Routes
# ============================================================================

routes = [
    Route('/', dashboard_page, methods=['GET']),

    Route('/api/projects', api_list_projects, methods=['GET']),
    Route('/api/projects', api_create_project, methods=['POST']),
    Route('/api/projects/{project_id}', api_delete_project, methods=['DELETE']),

    Route('/api/dashboard', api_dashboard, methods=['GET']),

    Route('/api/agents', api_agents, methods=['GET']),
    Route('/api/agents', api_create_agent, methods=['POST']),
    Route('/api/agents/{agent_id}', api_update_agent, methods=['PUT']),
    Route('/api/agents/{agent_id}', api_delete_agent, methods=['DELETE']),

    Route('/api/agents/{agent_id}/test-cases/{suite_type}', api_get_test_cases, methods=['GET']),
    Route('/api/agents/{agent_id}/test-cases/{suite_type}', api_create_test_case, methods=['POST']),
    Route('/api/agents/{agent_id}/test-cases/{suite_type}/{test_id}', api_delete_test_case, methods=['DELETE']),

    Route('/api/test-cases', api_list_test_cases, methods=['GET']),
    Route('/api/test-cases', api_save_test_case, methods=['POST']),
    Route('/api/test-cases/{test_id}', api_get_test_case, methods=['GET']),
    Route('/api/test-cases/{test_id}', api_delete_test_case_global, methods=['DELETE']),

    Route('/api/probe', api_probe, methods=['POST']),

    Route('/api/environments', api_environments, methods=['GET']),
    Route('/api/environments', api_create_environment, methods=['POST']),
    Route('/api/environments/{env_id}', api_update_environment, methods=['PUT']),
    Route('/api/environments/{env_id}', api_delete_environment, methods=['DELETE']),

    Route('/api/git/status', api_git_status, methods=['GET']),
    Route('/api/git/info', api_git_info, methods=['GET']),
    Route('/api/git/commit', api_git_commit, methods=['POST']),
    Route('/api/git/smart-commit', api_git_smart_commit, methods=['POST']),
    Route('/api/git/sync', api_git_sync, methods=['POST']),
    Route('/api/git/push', api_git_push, methods=['POST']),

    Route('/api/test-plans', api_test_plans, methods=['GET']),
    Route('/api/test-plans', api_create_test_plan, methods=['POST']),
    Route('/api/test-plans/{plan_id}', api_update_test_plan, methods=['PUT']),
    Route('/api/test-plans/{plan_id}', api_delete_test_plan, methods=['DELETE']),

    Route('/api/test-runs', api_test_runs, methods=['GET']),
    Route('/api/test-runs', api_start_test_run, methods=['POST']),
    Route('/api/test-runs/{run_id}', api_get_test_run, methods=['GET']),

    Route('/api/logs/{log_type}', api_logs, methods=['GET']),
    Route('/api/logs/{log_type}', api_clear_logs, methods=['DELETE']),

    Route('/api/tags', api_tags, methods=['GET', 'POST']),

    Mount('/static', StaticFiles(directory=str(STATIC_DIR)), name='static'),
]


# ============================================================================
# Application
# ============================================================================

@asynccontextmanager
async def lifespan(app):
    print("\n" + "="*60)
    print("Agent Test Manager Started")
    print("="*60)
    (WORKSPACES_DIR / '_global').mkdir(exist_ok=True)
    print(f"Dashboard: http://localhost:8000")
    print(f"Workspaces: {WORKSPACES_DIR}")
    print("="*60 + "\n")
    yield
    print("\nShutting down...\n")


app = Starlette(
    routes=routes,
    lifespan=lifespan,
    debug=True
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
