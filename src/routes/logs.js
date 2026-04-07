const router = require('express').Router();
const store = require('../store');
const { WS } = require('../workspace');
const { getProject } = require('../helpers');

router.get('/:log_type', (req, res) => {
  const ws = new WS(getProject(req));
  const content = store.readText(ws.logFile(req.params.log_type)) || 'No logs';
  res.json({ content });
});

router.delete('/:log_type', (req, res) => {
  const ws = new WS(getProject(req));
  store.delete(ws.logFile(req.params.log_type));
  res.json({ status: 'cleared' });
});

module.exports = router;
