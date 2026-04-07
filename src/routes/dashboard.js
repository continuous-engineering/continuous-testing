const router = require('express').Router();
router.get('/', (req, res) => res.json({ workspaces: 0, agents: 0, tests: 0, runs: 0, pass_rate: 0 }));
module.exports = router;
