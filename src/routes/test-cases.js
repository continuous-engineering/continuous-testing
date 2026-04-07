const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { WS, getWorkspacesDirectory, globalTestCasesDir, globalTestFile } = require('../workspace');
const { getProject } = require('../helpers');
const { loadAllAgents } = require('../agents-lib');

function makeTestId() {
  return `test_${uuidv4().replace(/-/g, '').slice(0, 8)}`;
}

function sanitizeId(id) {
  return id.replace(/[^\w-]/g, '_');
}

/**
 * Find a test file by test_id across all scopes.
 * Returns { filePath, test } or { filePath: null, test: null }.
 */
function findTestFile(project, testId) {
  const ws = new WS(project);
  const agents = loadAllAgents(ws);

  const candidateDirs = [
    globalTestCasesDir(),
    ws.testCasesDir,
    ...agents.map(a => ws.agentTestCasesDir(a.agent_id)),
  ];

  for (const dir of candidateDirs) {
    const filePath = path.join(dir, `${testId}.yaml`);
    if (fs.existsSync(filePath)) {
      return { filePath, test: store.load(filePath) };
    }
  }
  return { filePath: null, test: null };
}

// ── GET /api/test-cases ───────────────────────────────────
router.get('/', (req, res) => {
  const project = getProject(req);
  const { suite_type, tag, category, scope, agent_id: agentFilter } = req.query;
  const tagSet = tag ? new Set(tag.split(',').map(t => t.trim()).filter(Boolean)) : null;

  const ws = new WS(project);
  const agents = loadAllAgents(ws);
  const tests = [];

  function addFromDir(dir, source, extraFields = {}) {
    for (const filePath of store.list(dir).sort()) {
      if (path.basename(filePath) === 'baseline.yaml') continue;
      const t = store.load(filePath);
      if (!t || !t.test_id) continue;
      if (suite_type && t.suite_type && t.suite_type !== suite_type) continue;
      if (category && t.category !== category) continue;
      if (tagSet && !tagSet.intersection(new Set(t.tags || [])).size) continue;
      tests.push({ ...t, _source: source, ...extraFields });
    }
  }

  if (!scope || scope === 'global')
    addFromDir(globalTestCasesDir(), 'global');

  if (!scope || scope === 'workspace')
    addFromDir(ws.testCasesDir, 'workspace');

  if (!scope || scope === 'agent') {
    const filtered = agentFilter ? agents.filter(a => a.agent_id === agentFilter) : agents;
    for (const agent of filtered) {
      addFromDir(ws.agentTestCasesDir(agent.agent_id), 'agent', {
        _agent_id: agent.agent_id,
        _agent_name: agent.name || agent.agent_id,
      });
    }
  }

  res.json(tests);
});

// ── POST /api/test-cases ──────────────────────────────────
router.post('/', (req, res) => {
  const project = getProject(req);
  const body = req.body;
  const scope = body.scope || 'global';
  const suiteType = body.suite_type || 'functional';
  const agentId = body.agent_id || '';
  const editingId = body.editing_id || '';

  if (scope === 'global' && project !== '_global')
    return res.status(403).json({ error: 'Global test cases can only be created or edited from the Global project.' });

  let testId = sanitizeId((body.test_id || makeTestId()).trim());

  let targetDir;
  const workspacesDir = getWorkspacesDirectory();
  const ws = new WS(project);
  if (scope === 'global')
    targetDir = globalTestCasesDir();
  else if (scope === 'workspace')
    targetDir = ws.testCasesDir;
  else if (scope === 'agent' && agentId)
    targetDir = ws.agentTestCasesDir(agentId);
  else
    targetDir = ws.testCasesDir;

  fs.mkdirSync(targetDir, { recursive: true });

  // Remove old file if test_id was renamed
  if (editingId && editingId !== testId) {
    const { filePath: oldPath } = findTestFile(project, editingId);
    if (oldPath) store.delete(oldPath);
  }

  const test = {
    test_id: testId,
    suite_type: suiteType,
    test_name: body.test_name || '',
    user_prompt: body.user_prompt || '',
    expected_response: body.expected_response || '',
    expected_latency_ms: body.expected_latency_ms ?? 5000,
    min_semantic_match: body.min_semantic_match ?? 0.75,
    category: body.category || '',
    priority: body.priority || 'medium',
    tags: body.tags || [],
  };

  store.save(path.join(targetDir, `${testId}.yaml`), test);
  res.status(201).json(test);
});

// ── GET /api/test-cases/:test_id ─────────────────────────
router.get('/:test_id', (req, res) => {
  const { test } = findTestFile(getProject(req), req.params.test_id);
  if (!test) return res.status(404).json({ error: 'Test not found' });
  res.json(test);
});

// ── DELETE /api/test-cases/:test_id ──────────────────────
router.delete('/:test_id', (req, res) => {
  const project = getProject(req);
  const { test_id } = req.params;
  const { filePath } = findTestFile(project, test_id);
  if (!filePath) return res.status(404).json({ error: 'Test not found' });

  // Block deletion of global tests from non-global project
  const normalised = filePath.replace(/\\/g, '/');
  const isGlobal = normalised.includes('/_global/');
  if (isGlobal && project !== '_global')
    return res.status(403).json({ error: 'Global test cases can only be deleted from the Global project.' });

  store.delete(filePath);
  res.json({ deleted: test_id });
});

module.exports = router;
