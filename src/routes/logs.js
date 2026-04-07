const router = require('express').Router();
router.get('/:log_type', (req, res) => res.json({ content: 'No logs' }));
router.delete('/:log_type', (req, res) => res.status(501).json({ error: 'not implemented' }));
module.exports = router;
