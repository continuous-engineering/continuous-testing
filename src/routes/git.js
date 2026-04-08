const router = require('express').Router();
const path = require('path');
const simpleGit = require('simple-git');
const { WS, getWorkspacesDirectory } = require('../workspace');
const { getProject } = require('../helpers');

// Base dir for git operations = parent of workspaces/ (the project root)
function getBaseDir() {
  return path.dirname(getWorkspacesDirectory());
}

function git() {
  return simpleGit(getBaseDir());
}

// ── GET /api/git/status ───────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const project = getProject(req);
    const ws = new WS(project);
    const g = git();

    // Workspace-scoped diff
    const relRoot = path.relative(getBaseDir(), ws.root).replace(/\\/g, '/');
    const scopedStatus = await g.status([relRoot]);
    const lines = [
      ...scopedStatus.modified.map(f => `M  ${f}`),
      ...scopedStatus.not_added.map(f => `?? ${f}`),
      ...scopedStatus.deleted.map(f => `D  ${f}`),
    ];
    const output = lines.join('\n') || 'Nothing to commit';

    const overall = await g.status();
    res.json({ output, dirty: !overall.isClean() });
  } catch (e) {
    res.json({ output: e.message, dirty: false });
  }
});

// ── GET /api/git/info ─────────────────────────────────────
router.get('/info', async (req, res) => {
  try {
    const g = git();
    const branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'unknown';
    let ahead = 0, behind = 0;
    try {
      const raw = await g.raw(['rev-list', '--left-right', '--count', `HEAD...origin/${branch}`]);
      const parts = raw.trim().split(/\s+/);
      if (parts.length === 2) { ahead = parseInt(parts[0]); behind = parseInt(parts[1]); }
    } catch { /* no remote */ }

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
  const { message } = req.body;
  if (!message?.trim())
    return res.status(400).json({ success: false, output: 'No commit message' });

  try {
    const project = getProject(req);
    const ws = new WS(project);
    const g = git();
    const relRoot = path.relative(getBaseDir(), ws.root).replace(/\\/g, '/');

    await g.add(relRoot);
    // Unstage results/ and logs/ if caught
    const relResults = path.relative(getBaseDir(), path.join(ws.root, 'results')).replace(/\\/g, '/');
    const relLogs = path.relative(getBaseDir(), ws.logsDir).replace(/\\/g, '/');
    try { await g.raw(['reset', 'HEAD', '--', relResults]); } catch {}
    try { await g.raw(['reset', 'HEAD', '--', relLogs]); } catch {}

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
    const g = git();
    await g.fetch(['--all']);
    const branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'main';
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
  try {
    const g = git();
    const branch = (await g.revparse(['--abbrev-ref', 'HEAD'])).trim() || 'main';
    await g.push('origin', branch);
    res.json({ success: true, output: 'Pushed', branch });
  } catch (e) {
    res.json({ success: false, output: e.message, branch: '' });
  }
});

// ── POST /api/git/smart-commit ────────────────────────────
router.post('/smart-commit', async (req, res) => {
  const message = (req.body.message || 'update').trim();
  try {
    const g = git();
    const status = await g.status(['--', 'workspaces/']);
    const allFiles = [
      ...status.modified,
      ...status.not_added,
      ...status.deleted,
      ...status.created,
    ].filter(f => !f.includes('/results/') && !f.includes('/logs/'));

    if (!allFiles.length)
      return res.json({ success: true, output: 'Nothing to commit', commits: [] });

    // Group by scope
    const groups = new Map();
    for (const filePath of allFiles) {
      const parts = filePath.replace(/\\/g, '/').split('/');
      if (parts.length < 3) continue;
      const proj = parts[1];
      const rest = parts[2] || '';
      let key;
      if (proj === '_global')         key = `_global::`;
      else if (rest === 'agents')     key = `agents:${proj}:`;
      else if (rest === 'test-cases') key = `workspace:${proj}:`;
      else if (rest === 'config')     key = `config:${proj}:`;
      else                            key = `config:${proj}:`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(filePath);
    }

    const commits = [];
    for (const [key, files] of groups) {
      const [scope, proj] = key.split(':');
      let subject;
      if (scope === '_global')   subject = `test(global): ${message}`;
      else if (scope === 'agents')   subject = `feat(${proj}): ${message} [agents]`;
      else if (scope === 'workspace') subject = `test(${proj}): ${message} [workspace]`;
      else                           subject = `chore(${proj}): ${message}`;

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
    let pushed = false;
    let pushOutput = '';
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
router.post('/clone', async (req, res) => {
  const { url, dest } = req.body;
  if (!url || !dest)
    return res.status(400).json({ success: false, output: 'url and dest are required' });

  try {
    const fs = require('fs');
    fs.mkdirSync(dest, { recursive: true });
    const g = simpleGit();
    await g.clone(url, dest);
    // Point workspaces to the cloned repo's workspaces/ subdir
    const workspacesPath = path.join(dest, 'workspaces');
    if (!fs.existsSync(workspacesPath))
      fs.mkdirSync(path.join(workspacesPath, '_global', 'test-cases'), { recursive: true });
    res.json({ success: true, output: `Cloned to ${dest}`, workspacesDir: workspacesPath });
  } catch (e) {
    res.json({ success: false, output: e.message });
  }
});

module.exports = router;
