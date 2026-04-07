const router = require('express').Router();
const path = require('path');
const fs = require('fs');
const { getWorkspacesDirectory } = require('../workspace');

router.get('/', (req, res) => {
  const dir = getWorkspacesDirectory();
  if (!fs.existsSync(dir)) return res.json([]);
  const projects = [];
  for (const name of fs.readdirSync(dir).sort()) {
    try { if (!fs.statSync(path.join(dir, name)).isDirectory()) continue; } catch { continue; }
    const label = name === '_global'
      ? 'Global Tests'
      : name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    projects.push({ id: name, name: label });
  }
  res.json(projects);
});

router.post('/', (req, res) => {
  const projectId = (req.body.id || '').trim().toLowerCase();
  if (!/^[a-z0-9_-]+$/.test(projectId))
    return res.status(400).json({ error: 'Invalid project id — use lowercase letters, numbers, hyphens, underscores' });
  if (['_global', '_shared'].includes(projectId))
    return res.status(400).json({ error: 'Reserved project name' });

  const projectDir = path.join(getWorkspacesDirectory(), projectId);
  if (fs.existsSync(projectDir))
    return res.status(409).json({ error: 'Project already exists' });

  for (const sub of ['agents', 'config', 'results', 'logs', 'test-cases'])
    fs.mkdirSync(path.join(projectDir, sub), { recursive: true });

  res.status(201).json({ id: projectId, name: req.body.name || projectId });
});

router.delete('/:project_id', (req, res) => {
  const { project_id } = req.params;
  if (['default', '_global'].includes(project_id))
    return res.status(400).json({ error: `Cannot delete ${project_id}` });
  const projectDir = path.join(getWorkspacesDirectory(), project_id);
  if (!fs.existsSync(projectDir))
    return res.status(404).json({ error: 'Project not found' });
  fs.rmSync(projectDir, { recursive: true, force: true });
  res.json({ deleted: project_id });
});

module.exports = router;
