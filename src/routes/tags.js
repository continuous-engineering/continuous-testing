const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { WS } = require('../workspace');
const { getProject } = require('../helpers');

router.get('/', (req, res) => {
  const ws = new WS(getProject(req));
  res.json(store.load(ws.tags).tags || []);
});

router.post('/', (req, res) => {
  const ws = new WS(getProject(req));
  const data = store.load(ws.tags);
  if (!data.tags) data.tags = [];
  const tag = {
    id: uuidv4().replace(/-/g, '').slice(0, 8),
    name: req.body.name || '',
    color: req.body.color || '#3498db',
  };
  data.tags.push(tag);
  store.save(ws.tags, data);
  res.status(201).json(tag);
});

module.exports = router;
