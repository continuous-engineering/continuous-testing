/**
 * Git routes — per-project model.
 *
 * Each project (workspaces/<project>/) is its own independent git repository.
 * Git operations scope to that repo root — no shared parent repo needed.
 *
 * workspaces/
 *   e360/        ← git repo (origin: github.com/org/e360-tests)
 *   acme/        ← git repo (origin: github.com/org/acme-tests)
 *   _global/     ← read-only, managed by continuous.engineering (pull/sync only)
 *
 * _global is always shown in the projects table and can be synced (pull/rebase),
 * but commit and push are blocked — clients layer their own local tests on top.
 */

const GLOBAL_REMOTE = 'https://github.com/continuous-engineering/_global-testcases.git';

const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const { WS, getWorkspacesDirectory } = require('../workspace');
const { getProject } = require('../helpers');

/** Returns a simple-git instance rooted at the project directory. */
function projectGit(ws) {
  return simpleGit(ws.root);
}

/** Check if a directory is a git repo. */
function isGitRepo(dir) {
  try { return fs.existsSync(path.join(dir, '.git')); } catch { return false; }
}

/** Detect the default branch of a remote after fetch. */
async function detectDefaultBranch(g) {
  try {
    const out = await g.raw(['ls-remote', '--symref', 'origin', 'HEAD']);
    const m = out.match(/ref: refs\/heads\/(\S+)\s+HEAD/);
    if (m) return m[1];
  } catch {}
  try {
    const lines = (await g.raw(['branch', '-r']))
      .split('\n').map(l => l.trim()).filter(Boolean);
    const first = lines.find(l => !l.includes('->'))?.replace('origin/', '').trim();
    if (first) return first;
  } catch {}
  return 'main';
}

// ── GET /api/git/status ───────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const ws = new WS(getProject(req));
    if (!isGitRepo(ws.root))
      return res.json({ output: 'Not a git repo. Use Settings to clone or init.', dirty: false, no_repo: true });

    const g = projectGit(ws);
    const status = await g.status();
    const lines = [
      ...status.modified.map(f => `M  ${f}`),
      ...status.not_added.map(f => `?? ${f}`),
      ...status.deleted.map(f => `D  ${f}`),
      ...status.created.map(f => `A  ${f}`),
    ].filter(f => !f.includes('results/') && !f.includes('logs/'));

    res.json({ output: lines.join('\n') || 'Nothing to commit', dirty: !status.isClean() });
  } catch (e) {
    res.json({ output: e.message, dirty: false });
  }
});

// ── GET /api/git/info ─────────────────────────────────────
router.get('/info', async (req, res) => {
  try {
    const ws = new WS(getProject(req));
    if (!isGitRepo(ws.root))
      return res.json({ branch: '', ahead: 0, behind: 0, dirty: false, last_sync: null, no_repo: true });

    const g = projectGit(ws);
    const branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'unknown';
    let ahead = 0, behind = 0;
    try {
      const raw = await g.raw(['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`]);
      const parts = raw.trim().split(/\s+/);
      if (parts.length === 2) { ahead = parseInt(parts[0]); behind = parseInt(parts[1]); }
    } catch { /* no remote configured */ }

    let lastSync = null;
    try { lastSync = (await g.raw(['log', '-1', '--format=%cd', '--date=iso', 'FETCH_HEAD'])).trim() || null; } catch {}

    const status = await g.status();
    res.json({ branch, ahead, behind, dirty: !status.isClean(), last_sync: lastSync });
  } catch (e) {
    res.json({ branch: 'unknown', ahead: 0, behind: 0, dirty: false, last_sync: null });
  }
});

// ── POST /api/git/commit ──────────────────────────────────
router.post('/commit', async (req, res) => {
  if (getProject(req) === '_global')
    return res.json({ success: false, output: '_global is managed by continuous.engineering — sync only, no commits.' });

  const { message } = req.body;
  if (!message?.trim())
    return res.status(400).json({ success: false, output: 'No commit message' });

  try {
    const ws = new WS(getProject(req));
    if (!isGitRepo(ws.root))
      return res.json({ success: false, output: 'Not a git repo.' });

    const g = projectGit(ws);
    await g.add('.');
    try { await g.raw(['reset', 'HEAD', '--', 'results']); } catch {}
    try { await g.raw(['reset', 'HEAD', '--', 'logs']); } catch {}

    const result = await g.commit(message.trim());
    const status = await g.status();
    res.json({ success: true, output: result.summary?.toString() || 'Committed', dirty: !status.isClean() });
  } catch (e) {
    res.json({ success: false, output: e.message });
  }
});

// ── POST /api/git/sync ────────────────────────────────────
router.post('/sync', async (req, res) => {
  try {
    const ws = new WS(getProject(req));

    // _global: bootstrap on first use — directory may not exist at all
    if (ws.project === '_global' && !isGitRepo(ws.root)) {
      if (!fs.existsSync(ws.root)) {
        // Fresh install — clone directly into workspaces/_global/
        fs.mkdirSync(ws.workspacesDir, { recursive: true });
        await simpleGit(ws.workspacesDir).clone(GLOBAL_REMOTE, '_global');
        return res.json({ success: true, output: '_global cloned from continuous.engineering', conflicts: [], dirty: false });
      }
      // Directory exists but no .git (e.g. bundled YAML files, no repo yet)
      const g = simpleGit(ws.root);
      await g.init();
      await g.addRemote('origin', GLOBAL_REMOTE);
      await g.fetch(['origin']);
      const defaultBranch = await detectDefaultBranch(g);
      await g.raw(['checkout', '-b', defaultBranch, '--track', `origin/${defaultBranch}`]);
      return res.json({ success: true, output: '_global initialized and synced from continuous.engineering', conflicts: [], dirty: false });
    }

    if (!isGitRepo(ws.root))
      return res.json({ success: false, output: 'Not a git repo.', conflicts: [], dirty: false });

    const g = projectGit(ws);

    // _global: ensure remote is set (may have been bundled without .git)
    if (ws.project === '_global') {
      const remotes = await g.getRemotes();
      if (!remotes.find(r => r.name === 'origin')) {
        await g.addRemote('origin', GLOBAL_REMOTE);
      }
    }

    await g.fetch(['--all']);

    // Guard against unborn HEAD (init ran but checkout never completed)
    let branch;
    try {
      branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'main';
    } catch {
      // HEAD is unborn — detect default branch and finish checkout
      const defaultBranch = await detectDefaultBranch(g);
      await g.raw(['checkout', '-b', defaultBranch, '--track', `origin/${defaultBranch}`]);
      return res.json({ success: true, output: 'Sync complete', conflicts: [], dirty: false });
    }
    const tracking = `origin/${branch}`;

    try { await g.raw(['rev-parse', '--verify', tracking]); } catch {
      return res.json({ success: true, output: `No remote branch ${tracking} yet — nothing to sync`, conflicts: [], dirty: false });
    }

    try {
      await g.rebase([tracking]);
      const status = await g.status();
      res.json({ success: true, output: 'Sync complete', conflicts: [], dirty: !status.isClean() });
    } catch (rebaseErr) {
      let conflicts = [];
      try {
        const diff = await g.raw(['diff', '--name-only', '--diff-filter=U']);
        conflicts = diff.trim().split('\n').filter(Boolean);
        await g.rebase(['--abort']);
      } catch {}
      res.json({ success: false, output: rebaseErr.message, conflicts, dirty: true });
    }
  } catch (e) {
    res.json({ success: false, output: e.message, conflicts: [], dirty: false });
  }
});

// ── POST /api/git/push ────────────────────────────────────
router.post('/push', async (req, res) => {
  if (getProject(req) === '_global')
    return res.json({ success: false, output: '_global is managed by continuous.engineering — sync only, no push.' });

  try {
    const ws = new WS(getProject(req));
    if (!isGitRepo(ws.root))
      return res.json({ success: false, output: 'Not a git repo.', branch: '' });

    const g = projectGit(ws);
    const branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'main';
    await g.push('origin', branch);
    res.json({ success: true, output: 'Pushed', branch });
  } catch (e) {
    res.json({ success: false, output: e.message, branch: '' });
  }
});

// ── POST /api/git/smart-commit ────────────────────────────
router.post('/smart-commit', async (req, res) => {
  if (getProject(req) === '_global')
    return res.json({ success: false, output: '_global is managed by continuous.engineering — sync only, no commits.' });

  const message = (req.body.message || 'update').trim();
  try {
    const ws = new WS(getProject(req));
    if (!isGitRepo(ws.root))
      return res.json({ success: false, output: 'Not a git repo.', commits: [] });

    const project = ws.project;
    const g = projectGit(ws);
    const status = await g.status();

    const allFiles = [
      ...status.modified, ...status.not_added,
      ...status.deleted,  ...status.created,
    ].filter(f => !f.includes('results/') && !f.includes('logs/'));

    if (!allFiles.length)
      return res.json({ success: true, output: 'Nothing to commit', commits: [] });

    // Group by scope within the project repo
    // Paths are relative to ws.root:
    //   agents/<id>/agent.yaml          → agents
    //   agents/<id>/test-cases/*.yaml   → agent test (per agent)
    //   test-cases/*.yaml               → workspace tests
    //   config/*.yaml                   → config
    const groups = new Map();
    for (const f of allFiles) {
      const norm = f.replace(/\\/g, '/');
      let key;
      if (norm.startsWith('agents/') && norm.includes('/test-cases/')) {
        const agentId = norm.split('/')[1];
        key = `agent_test:${agentId}`;
      } else if (norm.startsWith('agents/')) {
        key = 'agents:';
      } else if (norm.startsWith('test-cases/')) {
        key = 'workspace_tests:';
      } else {
        key = 'config:';
      }
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(f);
    }

    const commits = [];
    for (const [key, files] of groups) {
      const [scope, extra] = key.split(':');
      let subject;
      if (scope === 'agents')          subject = `feat(${project}): ${message} [agents]`;
      else if (scope === 'agent_test') subject = `test(${project}/${extra}): ${message}`;
      else if (scope === 'workspace_tests') subject = `test(${project}): ${message} [workspace]`;
      else                             subject = `chore(${project}): ${message}`;

      for (const f of files) await g.add(f);
      try {
        await g.commit(subject);
        commits.push({ subject, success: true, files: files.length });
      } catch (e) {
        commits.push({ subject, success: false, error: e.message, files: files.length });
        break;
      }
    }

    const allOk = commits.every(c => c.success);
    let pushed = false, pushOutput = '';
    if (allOk && commits.length) {
      try {
        const branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'main';
        try { await g.rebase([`origin/${branch}`]); } catch {}
        await g.push('origin', branch);
        pushed = true;
        pushOutput = 'Pushed';
      } catch (e) { pushOutput = e.message; }
    }

    const finalStatus = await g.status();
    res.json({ success: allOk, commits, pushed, output: pushOutput, dirty: !finalStatus.isClean() });
  } catch (e) {
    res.json({ success: false, output: e.message, commits: [] });
  }
});

// ── POST /api/git/clone ───────────────────────────────────
// Clone a repo directly into workspaces/<project-name>/
// The cloned directory IS the project — no workspaces/ subfolder needed.
router.post('/clone', async (req, res) => {
  const { url, project_name } = req.body;
  if (!url) return res.status(400).json({ success: false, output: 'url is required' });

  // Derive project name from URL if not provided
  const name = (project_name || url.split('/').pop().replace(/\.git$/, '') || 'project')
    .toLowerCase().replace(/[^a-z0-9_-]/g, '-');

  const workspacesDir = getWorkspacesDirectory();
  const dest = path.join(workspacesDir, name);

  if (fs.existsSync(dest))
    return res.status(409).json({ success: false, output: `Project "${name}" already exists at ${dest}` });

  try {
    fs.mkdirSync(workspacesDir, { recursive: true });
    const g = simpleGit();
    await g.clone(url, dest);

    // Ensure standard dirs exist
    for (const sub of ['agents', 'test-cases', 'config', 'results', 'logs'])
      fs.mkdirSync(path.join(dest, sub), { recursive: true });

    res.json({ success: true, output: `Cloned into ${dest}`, project: name, projectDir: dest });
  } catch (e) {
    // Clean up partial clone
    try { fs.rmSync(dest, { recursive: true, force: true }); } catch {}
    res.json({ success: false, output: e.message });
  }
});

// ── GET /api/git/workspace-repos ─────────────────────────
// List all projects in the workspace with their git + remote status.
// No X-Project header needed — workspace-wide scan.
router.get('/workspace-repos', async (req, res) => {
  const workspacesDir = getWorkspacesDirectory();
  if (!fs.existsSync(workspacesDir)) return res.json([]);

  // _global always appears first — read-only, managed by continuous.engineering
  const globalDir = path.join(workspacesDir, '_global');
  const globalEntry = await (async () => {
    if (!fs.existsSync(globalDir)) return { name: '_global', isRepo: false, remote: GLOBAL_REMOTE, branch: null, readOnly: true };
    const isRepo = isGitRepo(globalDir);
    let remote = GLOBAL_REMOTE;
    let branch = null;
    if (isRepo) {
      try {
        const g = simpleGit(globalDir);
        branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || null;
      } catch {}
    }
    return { name: '_global', isRepo, remote, branch, readOnly: true };
  })();

  const entries = [globalEntry];
  for (const name of fs.readdirSync(workspacesDir).sort()) {
    if (name === '_global') continue;
    const dir = path.join(workspacesDir, name);
    try { if (!fs.statSync(dir).isDirectory()) continue; } catch { continue; }

    const isRepo = isGitRepo(dir);
    let remote = null;
    let branch = null;
    if (isRepo) {
      try {
        const g = simpleGit(dir);
        const remotes = await g.getRemotes(true);
        const origin = remotes.find(r => r.name === 'origin');
        remote = origin?.refs?.fetch || null;
        branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || null;
      } catch {}
    }
    entries.push({ name, isRepo, remote, branch, readOnly: false });
  }
  res.json(entries);
});

// ── POST /api/git/remote ──────────────────────────────────
// Add or update the `origin` remote for the current project.
router.post('/remote', async (req, res) => {
  const { url } = req.body;
  if (!url?.trim()) return res.status(400).json({ success: false, output: 'url is required' });

  try {
    const ws = new WS(getProject(req));
    if (!isGitRepo(ws.root))
      return res.json({ success: false, output: 'Not a git repo — initialize it first.' });

    const g = projectGit(ws);
    const remotes = await g.getRemotes();
    if (remotes.find(r => r.name === 'origin')) {
      await g.remote(['set-url', 'origin', url.trim()]);
    } else {
      await g.addRemote('origin', url.trim());
    }
    res.json({ success: true, output: `Remote origin → ${url.trim()}` });
  } catch (e) {
    res.json({ success: false, output: e.message });
  }
});

// ── POST /api/git/init ────────────────────────────────────
// Initialize the current project directory as a new git repo.
router.post('/init', async (req, res) => {
  try {
    const ws = new WS(getProject(req));
    if (isGitRepo(ws.root))
      return res.json({ success: false, output: 'Already a git repo.' });

    const g = simpleGit(ws.root);
    await g.init();
    res.json({ success: true, output: `Initialized git repo at ${ws.root}` });
  } catch (e) {
    res.json({ success: false, output: e.message });
  }
});

module.exports = router;
