/**
 * Shared helpers for agent loading — used by routes/agents.js,
 * routes/dashboard.js, routes/test-runs.js, etc.
 */
const fs = require('fs');
const store = require('./store');

/**
 * Load all agents for a workspace. Agents live in agents/<id>/agent.yaml.
 */
function loadAllAgents(ws) {
  if (!fs.existsSync(ws.agentsDir)) return [];
  const agents = [];
  for (const id of store.listDirs(ws.agentsDir).sort()) {
    const data = store.load(ws.agentFile(id));
    if (data && Object.keys(data).length > 0) agents.push(data);
  }
  return agents;
}

/**
 * Collect tests for a single agent from all 3 levels (global → workspace → agent).
 * suite_type is stored as a field inside each test YAML.
 * If suiteType is provided, only tests whose suite_type field matches are returned
 * (tests with no suite_type field pass through — backward compatibility).
 */
function collectTests(ws, agentId, suiteType) {
  const { globalTestCasesDir } = require('./workspace');
  const levels = [
    { dir: globalTestCasesDir(), source: 'global' },
    { dir: ws.testCasesDir, source: 'workspace' },
    { dir: ws.agentTestCasesDir(agentId), source: 'agent' },
  ];
  const tests = [];
  for (const { dir, source } of levels) {
    for (const filePath of store.list(dir).sort()) {
      const name = require('path').basename(filePath);
      if (name === 'baseline.yaml') continue;
      const test = store.load(filePath);
      if (!test || !test.test_id) continue;
      if (suiteType && test.suite_type && test.suite_type !== suiteType) continue;
      tests.push({ ...test, _source: source });
    }
  }
  return tests;
}

module.exports = { loadAllAgents, collectTests };
