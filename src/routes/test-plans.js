const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const store = require('../store');
const { WS } = require('../workspace');
const { getProject } = require('../helpers');

router.get('/', (req, res) => {
  const ws = new WS(getProject(req));
  res.json(store.load(ws.testPlans).run_configs || []);
});

router.post('/', (req, res) => {
  const ws = new WS(getProject(req));
  const body = req.body;
  const config = {
    config_id: `rc_${uuidv4().replace(/-/g, '').slice(0, 8)}`,
    name: body.name || 'New Test Plan',
    agent_ids: body.agent_ids || [],
    suite_types: body.suite_types || ['functional'],
    tags: body.tags || [],
    created_at: new Date().toISOString(),
  };
  const data = store.load(ws.testPlans);
  if (!data.run_configs) data.run_configs = [];
  data.run_configs.push(config);
  store.save(ws.testPlans, data);
  res.status(201).json(config);
});

router.put('/:plan_id', (req, res) => {
  const ws = new WS(getProject(req));
  const { plan_id } = req.params;
  const data = store.load(ws.testPlans);
  const configs = data.run_configs || [];
  const idx = configs.findIndex(c => c.config_id === plan_id);
  if (idx < 0) return res.status(404).json({ error: 'Test plan not found' });
  const body = req.body;
  configs[idx] = {
    ...configs[idx],
    name: body.name ?? configs[idx].name,
    agent_ids: body.agent_ids ?? configs[idx].agent_ids,
    suite_types: body.suite_types ?? configs[idx].suite_types,
    tags: body.tags ?? configs[idx].tags,
  };
  data.run_configs = configs;
  store.save(ws.testPlans, data);
  res.json(configs[idx]);
});

router.delete('/:plan_id', (req, res) => {
  const ws = new WS(getProject(req));
  const { plan_id } = req.params;
  const data = store.load(ws.testPlans);
  data.run_configs = (data.run_configs || []).filter(c => c.config_id !== plan_id);
  store.save(ws.testPlans, data);
  res.json({ deleted: plan_id });
});

module.exports = router;
