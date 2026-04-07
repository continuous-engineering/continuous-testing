const router = require('express').Router();
// Bundle B will implement these
router.get('/', (req, res) => res.json([]));
router.post('/', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.delete('/:project_id', (req, res) => res.status(501).json({ error: 'not implemented' }));
module.exports = router;
