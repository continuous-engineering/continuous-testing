const router = require('express').Router();
const fs = require('fs');
const path = require('path');
const store = require('../store');
const { WS, getWorkspacesDirectory } = require('../workspace');
const { getProject } = require('../helpers');
const { loadAllAgents } = require('../agents-lib');

router.get('/', (req, res) => {
  const project = getProject(req);
  const ws = new WS(project);
  const agents = loadAllAgents(ws);

  let totalTests = 0, functionalTests = 0, securityTests = 0;
  for (const agent of agents) {
    const dir = ws.agentTestCasesDir(agent.agent_id);
    for (const f of store.list(dir)) {
      const t = store.load(f);
      if (!t || !t.test_id) continue;
      totalTests++;
      if (t.suite_type === 'security') securityTests++;
      else functionalTests++;
    }
  }
  // Also count workspace-level tests
  for (const f of store.list(ws.testCasesDir)) {
    const t = store.load(f);
    if (!t || !t.test_id) continue;
    totalTests++;
    if (t.suite_type === 'security') securityTests++;
    else functionalTests++;
  }

  const runsData = store.load(ws.resultsFile);
  const runs = runsData.runs || [];
  const avgPassRate = runs.length
    ? runs.reduce((s, r) => s + (r.pass_rate || 0), 0) / runs.length
    : 0;
  const totalPassed = runs.reduce((s, r) => s + (r.summary?.passed || 0), 0);
  const totalFailed = runs.reduce((s, r) => s + (r.summary?.failed || 0), 0);

  const workspacesDir = getWorkspacesDirectory();
  const workspaceCount = fs.existsSync(workspacesDir)
    ? fs.readdirSync(workspacesDir).filter(n => {
        try { return fs.statSync(path.join(workspacesDir, n)).isDirectory(); } catch { return false; }
      }).length
    : 1;

  res.json({
    agents: agents.length,
    total_tests: totalTests,
    functional_tests: functionalTests,
    security_tests: securityTests,
    recent_test_runs: runs.length,
    avg_pass_rate: avgPassRate,
    total_passed: totalPassed,
    total_failed: totalFailed,
    workspaces: workspaceCount,
  });
});

module.exports = router;
