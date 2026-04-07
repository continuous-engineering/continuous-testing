const router = require('express').Router();
const store = require('../store');
const { WS } = require('../workspace');
const { getProject } = require('../helpers');
const { loadAllAgents, collectTests } = require('../agents-lib');
const { buildRunRecord } = require('../executor');

// ── GET /api/test-runs ────────────────────────────────────
router.get('/', (req, res) => {
  const ws = new WS(getProject(req));
  const { limit = 50, agent_id } = req.query;
  let runs = store.load(ws.resultsFile).runs || [];
  if (agent_id) runs = runs.filter(r => r.agent_id === agent_id);
  const summary = runs.slice(-Number(limit)).map(r => {
    const { results: _, ...rest } = r;
    return rest;
  });
  res.json(summary);
});

// ── GET /api/test-runs/:run_id ────────────────────────────
router.get('/:run_id', (req, res) => {
  const ws = new WS(getProject(req));
  const data = store.load(ws.resultsFile);
  const run = (data.runs || []).find(r => r.run_id === req.params.run_id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
});

// ── POST /api/test-runs ───────────────────────────────────
router.post('/', async (req, res) => {
  const project = getProject(req);
  const ws = new WS(project);
  const body = req.body;
  const configId = body.config_id;

  const data = store.load(ws.resultsFile);
  if (!data.runs) data.runs = [];

  if (configId) {
    // Config-based batch run
    const configsData = store.load(ws.testPlans);
    const config = (configsData.run_configs || []).find(c => c.config_id === configId);
    if (!config) return res.status(404).json({ error: `Run config ${configId} not found` });

    const allAgents = loadAllAgents(ws);
    const agentIds = config.agent_ids || [];
    const targetAgents = agentIds.length
      ? allAgents.filter(a => agentIds.includes(a.agent_id))
      : allAgents;
    if (!targetAgents.length)
      return res.status(400).json({ error: 'No agents found for this config' });

    const suiteTypes = config.suite_types || ['functional'];
    const tagFilter = new Set(config.tags || []);
    const storedRuns = [];

    for (const agent of targetAgents) {
      for (const suiteType of suiteTypes) {
        let tests = collectTests(ws, agent.agent_id, suiteType);
        if (tagFilter.size)
          tests = tests.filter(t => (t.tags || []).some(tag => tagFilter.has(tag)));
        if (!tests.length) continue;

        const run = await buildRunRecord(agent, suiteType, tests, configId, config.name);
        data.runs.push(run);
        const { results: _, ...summary } = run;
        storedRuns.push(summary);
      }
    }

    store.save(ws.resultsFile, data);

    const totals = storedRuns.reduce((acc, r) => {
      acc.passed += r.summary.passed;
      acc.failed += r.summary.failed;
      acc.errors += r.summary.errors;
      acc.total  += r.summary.total;
      return acc;
    }, { passed: 0, failed: 0, errors: 0, total: 0 });

    return res.status(201).json({
      batch: true,
      config_id: configId,
      config_name: config.name || '',
      runs: storedRuns,
      total_summary: { ...totals, run_count: storedRuns.length },
    });
  }

  // Quick run — single agent
  const agentId = body.agent_id || '';
  const suiteType = body.suite_type || 'functional';
  const agentFile = ws.agentFile(agentId);
  if (!store.exists(agentFile))
    return res.status(404).json({ error: `Agent ${agentId} not found` });

  const agent = store.load(agentFile);
  const tests = collectTests(ws, agentId, suiteType);
  if (!tests.length)
    return res.status(400).json({ error: 'No tests found for this agent and suite' });

  const run = await buildRunRecord(agent, suiteType, tests);
  data.runs.push(run);
  store.save(ws.resultsFile, data);

  const { results: _, ...summary } = run;
  res.status(201).json(summary);
});

module.exports = router;
