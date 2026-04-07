const router = require('express').Router();
const store = require('../store');
const { WS } = require('../workspace');
const { getProject } = require('../helpers');
const { callAgent, buildAuthHeaders } = require('../executor');

router.post('/', async (req, res) => {
  const ws = new WS(getProject(req));
  const { agent_id, prompt = '' } = req.body;

  const agentFile = ws.agentFile(agent_id);
  if (!store.exists(agentFile))
    return res.status(404).json({ error: `Agent ${agent_id} not found` });

  const agent = store.load(agentFile);
  const endpoint = (agent.endpoint || '').trim();
  if (!endpoint)
    return res.status(400).json({ error: 'Agent has no endpoint configured' });

  const { text, raw, error } = await callAgent(
    endpoint, prompt,
    buildAuthHeaders(agent),
    agent.body_template,
    agent.response_path || ''
  );

  if (error) return res.json({ error });
  res.json({ response: text, raw });
});

module.exports = router;
