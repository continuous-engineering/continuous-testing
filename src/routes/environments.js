const router = require('express').Router();
router.get('/', (req, res) => res.json([]));
router.post('/', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.put('/:env_id', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.delete('/:env_id', (req, res) => res.status(501).json({ error: 'not implemented' }));
module.exports = router;
