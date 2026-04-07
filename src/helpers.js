const fs = require('fs');
const path = require('path');
const { getWorkspacesDirectory, RESERVED_PROJECTS } = require('./workspace');

/**
 * Extract active project from X-Project request header.
 * Falls back to first non-reserved workspace dir if header is missing/invalid.
 * Returns '' if no workspaces exist yet.
 */
function getProject(req) {
  const raw = (req.headers['x-project'] || '').trim();
  const workspacesDir = getWorkspacesDirectory();

  if (raw && /^[a-zA-Z0-9_-]+$/.test(raw) && !RESERVED_PROJECTS.has(raw)) {
    const candidate = path.join(workspacesDir, raw);
    try {
      if (fs.statSync(candidate).isDirectory()) return raw;
    } catch { /* fall through */ }
  }

  // Fallback: first non-reserved, non-hidden workspace directory
  try {
    const entries = fs.readdirSync(workspacesDir).sort();
    for (const name of entries) {
      if (name.startsWith('_') || name.startsWith('.')) continue;
      if (RESERVED_PROJECTS.has(name)) continue;
      try {
        if (fs.statSync(path.join(workspacesDir, name)).isDirectory()) return name;
      } catch { /* skip */ }
    }
  } catch { /* workspacesDir doesn't exist yet */ }

  return '';
}

module.exports = { getProject };
