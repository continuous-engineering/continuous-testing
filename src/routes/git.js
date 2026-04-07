const router = require('express').Router();
router.get('/status', (req, res) => res.json({ dirty: false, files: [] }));
router.get('/info', (req, res) => res.json({ branch: '', ahead: 0, behind: 0 }));
router.post('/commit', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.post('/smart-commit', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.post('/sync', (req, res) => res.status(501).json({ error: 'not implemented' }));
router.post('/push', (req, res) => res.status(501).json({ error: 'not implemented' }));
module.exports = router;
