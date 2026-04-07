const path = require('path');
const fs = require('fs');

const RESERVED_PROJECTS = new Set(['_global']);

/**
 * Resolve the workspaces root directory.
 * Dev: <projectRoot>/workspaces
 * Prod: <userData>/workspaces
 */
function getWorkspacesDirectory() {
  try {
    const { app } = require('electron');
    if (app && app.isPackaged) {
      return path.join(app.getPath('userData'), 'workspaces');
    }
  } catch {
    // Not running inside Electron (e.g., tests)
  }
  return path.join(__dirname, '..', 'workspaces');
}

/**
 * Workspace-scoped path helper — mirrors the Python WS class.
 * All paths are absolute strings (not Path objects).
 */
class WS {
  constructor(project) {
    this.project = project;
    this.workspacesDir = getWorkspacesDirectory();
    this.root = path.join(this.workspacesDir, project);
    this.agentsDir = path.join(this.root, 'agents');
    this.testCasesDir = path.join(this.root, 'test-cases');
    this.configDir = path.join(this.root, 'config');
    this.resultsFile = path.join(this.root, 'results', 'runs.yaml');
    this.logsDir = path.join(this.root, 'logs');
    this.environments = path.join(this.configDir, 'environments.yaml');
    this.tags = path.join(this.configDir, 'tags.yaml');
    this.testPlans = path.join(this.configDir, 'test_plans.yaml');
  }

  // Agent paths
  agentDir(agentId) {
    return path.join(this.agentsDir, agentId);
  }

  agentFile(agentId) {
    return path.join(this.agentsDir, agentId, 'agent.yaml');
  }

  agentTestCasesDir(agentId) {
    return path.join(this.agentsDir, agentId, 'test-cases');
  }

  agentTestFile(agentId, testId) {
    return path.join(this.agentsDir, agentId, 'test-cases', `${testId}.yaml`);
  }

  // Workspace-level test paths
  workspaceTestFile(testId) {
    return path.join(this.testCasesDir, `${testId}.yaml`);
  }

  // Log paths
  logFile(logType) {
    return path.join(this.logsDir, `${logType}.log`);
  }
}

// Global (_global workspace) paths
function globalTestCasesDir() {
  return path.join(getWorkspacesDirectory(), '_global', 'test-cases');
}

function globalTestFile(testId) {
  return path.join(getWorkspacesDirectory(), '_global', 'test-cases', `${testId}.yaml`);
}

module.exports = { WS, globalTestCasesDir, globalTestFile, getWorkspacesDirectory, RESERVED_PROJECTS };
