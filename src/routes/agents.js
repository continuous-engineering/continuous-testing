const router = require('express').Router();
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { WS } = require('../workspace');
const { getProject } = require('../helpers');
const { loadAllAgents } = require('../agents-lib');

// ── GET /api/agents ───────────────────────────────────────
router.get('/', (req, res) => {
  const project = getProject(req);
  if (project === '_global') return res.json([]);
  const ws = new WS(project);
  const agents = loadAllAgents(ws).map(agent => {
    const agentId = agent.agent_id || '';
    const suites = {};
    for (const suite of ['functional', 'security']) {
      const dir = ws.agentTestCasesDir(agentId);
      if (fs.existsSync(dir)) {
        const count = store.list(dir).filter(f => {
          const t = store.load(f);
          return t && (!suite || !t.suite_type || t.suite_type === suite);
        }).length;
        if (count) suites[suite] = { test_count: count };
      }
    }
    return { ...agent, suites };
  });
  res.json(agents);
});

// ── POST /api/agents ──────────────────────────────────────
router.post('/', (req, res) => {
  const project = getProject(req);
  if (project === '_global')
    return res.status(403).json({ error: 'Agents cannot be created in the Global project.' });

  const ws = new WS(project);
  const body = req.body;
  const agentId = `agent_${uuidv4().replace(/-/g, '').slice(0, 8)}`;
  const agent = {
    agent_id: agentId,
    name: body.name || 'New Agent',
    endpoint: body.endpoint || '',
    model_version: body.model_version || 'v1.0',
    auth_type: body.auth_type || 'none',
    auth_value: body.auth_value || '',
    auth_header: body.auth_header || '',
    body_template: body.body_template || '',
    response_path: body.response_path || '',
    status: 'active',
  };

  fs.mkdirSync(ws.agentTestCasesDir(agentId), { recursive: true });
  store.save(ws.agentFile(agentId), agent);
  res.status(201).json(agent);
});

// ── PUT /api/agents/:agent_id ─────────────────────────────
router.put('/:agent_id', (req, res) => {
  const ws = new WS(getProject(req));
  const { agent_id } = req.params;
  const agentFile = ws.agentFile(agent_id);
  if (!store.exists(agentFile))
    return res.status(404).json({ error: 'Agent not found' });

  const agent = store.load(agentFile);
  const body = req.body;
  Object.assign(agent, {
    name: body.name ?? agent.name,
    endpoint: body.endpoint ?? agent.endpoint,
    model_version: body.model_version ?? agent.model_version,
    auth_type: body.auth_type ?? agent.auth_type,
    auth_value: body.auth_value ?? agent.auth_value,
    auth_header: body.auth_header ?? agent.auth_header,
    body_template: body.body_template ?? agent.body_template,
    response_path: body.response_path ?? agent.response_path,
  });
  store.save(agentFile, agent);
  res.json(agent);
});

// ── DELETE /api/agents/:agent_id ──────────────────────────
router.delete('/:agent_id', (req, res) => {
  const ws = new WS(getProject(req));
  const { agent_id } = req.params;
  const agentDir = ws.agentDir(agent_id);
  if (!fs.existsSync(agentDir))
    return res.status(404).json({ error: 'Agent not found' });
  fs.rmSync(agentDir, { recursive: true, force: true });
  res.json({ deleted: agent_id });
});

// ── GET /api/agents/:agent_id/test-cases/:suite_type ─────
router.get('/:agent_id/test-cases/:suite_type', (req, res) => {
  const ws = new WS(getProject(req));
  const { agent_id, suite_type } = req.params;
  const dir = ws.agentTestCasesDir(agent_id);
  const tests = store.list(dir)
    .map(f => store.load(f))
    .filter(t => t && t.test_id && (!t.suite_type || t.suite_type === suite_type));
  res.json(tests);
});

// ── POST /api/agents/:agent_id/test-cases/:suite_type ────
router.post('/:agent_id/test-cases/:suite_type', (req, res) => {
  const ws = new WS(getProject(req));
  const { agent_id, suite_type } = req.params;
  const body = req.body;

  let testId = (body.test_id || `test_${uuidv4().replace(/-/g, '').slice(0, 8)}`).trim();
  testId = testId.replace(/[^\w-]/g, '_');

  const test = {
    test_id: testId,
    suite_type: suite_type,
    test_name: body.test_name || '',
    user_prompt: body.user_prompt || '',
    expected_response: body.expected_response || '',
    expected_latency_ms: body.expected_latency_ms ?? 5000,
    min_semantic_match: body.min_semantic_match ?? 0.75,
    category: body.category || '',
    priority: body.priority || 'medium',
    tags: body.tags || [],
  };

  fs.mkdirSync(ws.agentTestCasesDir(agent_id), { recursive: true });
  store.save(ws.agentTestFile(agent_id, testId), test);
  res.status(201).json(test);
});

// ── DELETE /api/agents/:agent_id/test-cases/:suite_type/:test_id ─
router.delete('/:agent_id/test-cases/:suite_type/:test_id', (req, res) => {
  const ws = new WS(getProject(req));
  const { agent_id, test_id } = req.params;
  store.delete(ws.agentTestFile(agent_id, test_id));
  res.json({ deleted: test_id });
});

module.exports = router;
