const router = require('express').Router();
router.get('/', (req, res) => res.json([]));
router.post('/', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.get('/:run_id', (req, res) => res.status(404).json({ error: 'not found' }));
module.exports = router;
