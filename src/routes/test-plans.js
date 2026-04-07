const router = require('express').Router();
router.get('/', (req, res) => res.json([]));
router.post('/', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.put('/:plan_id', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.delete('/:plan_id', (req, res) => res.status(501).json({ error: 'not implemented' }));
module.exports = router;
