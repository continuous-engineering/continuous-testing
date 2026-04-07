# AI-Test — Agent Test Manager

## Stack

- **Language:** Python 3.11
- **Framework:** Starlette (ASGI) + Uvicorn
- **Storage:** YAML files (no database)
- **Frontend:** Vanilla HTML/JS/CSS in `static/` (no build step)
- **Realtime:** WebSockets

## Build Commands

- **Check:** `python -m py_compile server.py`
- **Build:** N/A (interpreted)
- **Test:** none defined yet
- **Run:** `python server.py`
- **Port:** http://localhost:8000

---

## Architecture

Backend is `server.py`. Frontend is static files in `static/` served at `/static/*`.

### Layers

```
server.py
├── Configuration          # BASE_DIR, TESTS_DIR, RESULTS_DIR, etc.
├── Store                  # YAML file read/write abstraction
├── Domain models          # Agent, TestRun, Tag — plain dicts in YAML
├── API route handlers     # /api/agents, /api/runs, /api/tags, /api/logs
└── lifespan               # Startup/shutdown hooks

static/
├── index.html             # HTML structure
├── app.js                 # All JS — API calls, page logic, UI state
└── styles.css             # All CSS
```

### Storage layout

**One file per entity** — agents and tests are individual YAML files, never lists inside a single file.

```
workspaces/
  _global/                             # Global tests — apply to ALL agents in ALL projects
    _shared/
      functional/<test_id>.yaml
      security/<test_id>.yaml

  <project>/
    agents/<agent_id>.yaml             # One file per agent
    _shared/                           # Workspace tests — apply to all agents in this project
      functional/<test_id>.yaml
      security/<test_id>.yaml
    <agent_id>/                        # Agent-level tests
      functional/<test_id>.yaml
      security/<test_id>.yaml
    results/runs.yaml                  # GITIGNORED — runtime artifact
    logs/                              # GITIGNORED — runtime artifact
    config/
      profiles.yaml
      tags.yaml
      run_configs.yaml
```

**Test hierarchy (runner collects in order):**
1. Global → `workspaces/_global/_shared/<suite>/*.yaml`
2. Workspace → `workspaces/<project>/_shared/<suite>/*.yaml`
3. Agent → `workspaces/<project>/<agent_id>/<suite>/*.yaml`

Each test result carries a `_source` field: `'global' | 'workspace' | 'agent'`.

**Reserved names:**
- `_global` — reserved project name for global tests
- `_shared` — reserved agent_id for workspace/global test scope

Files are the source of truth. No in-memory state survives a restart.

### Key constraints

- **YAML only** — no SQLite, no JSON blobs, no external DB
- **One file per entity** — never append to a list inside a YAML; create/delete individual files
- **No frontend build step** — all JS is vanilla, no bundler
- **Windows-safe output** — no emoji in `print()` calls (cp1252 codec limitation)
- **results/ and logs/ are gitignored** — never commit runtime artifacts

---

## How to Write Things

### Adding a new API endpoint

1. Write the async handler function near the relevant domain section
2. Add a `Route(...)` entry to the `routes` list at the bottom of the file
3. Keep handlers thin — load from `Store`, transform, return `JSONResponse`

```python
async def get_something(request):
    data = Store.load(SOME_FILE)
    return JSONResponse(data.get("items", []))
```

### Adding a new UI section

Find the relevant `<!-- Page -->` comment in `static/index.html` and add the HTML there. Add the corresponding JS function to `static/app.js` and wire it up in `switchPage()`.

### Modifying storage

`Store.load(path)` returns a dict (empty dict if file missing). `Store.save(path, data)` writes it back.

For agents: read/write `WS.agent_file(agent_id)` — one dict per file (no list wrapper).
For tests: read/write `WS.test_file(agent_id, suite_type, test_id)` — one dict per file.
To list tests: glob `WS.suite_dir(agent_id, suite_type) / "*.yaml"`, skip `baseline.yaml`.
To collect for a run: use `_collect_tests(project, agent_id, suite_type)` — returns all 3 levels.

---

## Gotchas

- **Port conflicts:** if 8000 is busy, kill the old process with `powershell -Command "Stop-Process -Id <PID> -Force"`
- **Emoji in print():** Windows cp1252 terminal will crash on non-ASCII in `print()`. Use plain ASCII in all server-side output.
- **YAML_AVAILABLE guard:** yaml import is optional — check `YAML_AVAILABLE` before any yaml call.
