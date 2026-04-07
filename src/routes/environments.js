const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { WS } = require('../workspace');
const { getProject } = require('../helpers');

router.get('/', (req, res) => {
  const ws = new WS(getProject(req));
  res.json(store.load(ws.environments).profiles || []);
});

router.post('/', (req, res) => {
  const ws = new WS(getProject(req));
  const data = store.load(ws.environments);
  if (!data.profiles) data.profiles = [];
  const profile = {
    id: uuidv4().replace(/-/g, '').slice(0, 8),
    name: req.body.name || 'New Environment',
    variables: req.body.variables || {},
  };
  data.profiles.push(profile);
  store.save(ws.environments, data);
  res.status(201).json(profile);
});

router.put('/:env_id', (req, res) => {
  const ws = new WS(getProject(req));
  const { env_id } = req.params;
  const data = store.load(ws.environments);
  const profiles = data.profiles || [];
  const idx = profiles.findIndex(p => p.id === env_id);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  profiles[idx] = { ...profiles[idx], name: req.body.name ?? profiles[idx].name, variables: req.body.variables ?? {} };
  data.profiles = profiles;
  store.save(ws.environments, data);
  res.json(profiles[idx]);
});

router.delete('/:env_id', (req, res) => {
  const ws = new WS(getProject(req));
  const { env_id } = req.params;
  const data = store.load(ws.environments);
  data.profiles = (data.profiles || []).filter(p => p.id !== env_id);
  store.save(ws.environments, data);
  res.json({ deleted: env_id });
});

module.exports = router;
