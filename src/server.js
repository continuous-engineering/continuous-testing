const express = require('express');
const path = require('path');

function createServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Static files — index.html + app.js + styles.css (zero changes from original)
  app.use('/static', express.static(path.join(__dirname, '..', 'static')));

  // API routes
  app.use('/api/projects', require('./routes/projects'));
  app.use('/api/agents', require('./routes/agents'));
  app.use('/api/test-cases', require('./routes/test-cases'));
  app.use('/api/environments', require('./routes/environments'));
  app.use('/api/tags', require('./routes/tags'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/test-plans', require('./routes/test-plans'));
  app.use('/api/test-runs', require('./routes/test-runs'));
  app.use('/api/git', require('./routes/git'));
  app.use('/api/logs', require('./routes/logs'));
  app.use('/api/probe', require('./routes/probe'));

  // App info
  app.get('/api/settings/app-info', (req, res) => {
    const pkg = require('../package.json');
    res.json({ version: pkg.version, name: pkg.productName || pkg.name });
  });

  // Root — serve index.html
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'static', 'index.html'));
  });

  return app;
}

module.exports = createServer;
