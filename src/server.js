const express = require('express');
const path = require('path');

function createServer() {
  const app = express();

  app.use(express.json({ limit: '10mb' }));

  // Static files — index.html + app.js + styles.css (zero changes from original)
  app.use('/static', express.static(path.join(__dirname, '..', 'static')));

  // Core routes — loaded eagerly (needed on first paint)
  app.use('/api/projects',  require('./routes/projects'));
  app.use('/api/dashboard', require('./routes/dashboard'));

  // Lazy routes — required on first request to keep startup fast
  const lazy = (mod) => (req, res, next) => require(mod)(req, res, next);
  app.use('/api/agents',       lazy('./routes/agents'));
  app.use('/api/test-cases',   lazy('./routes/test-cases'));
  app.use('/api/environments', lazy('./routes/environments'));
  app.use('/api/tags',         lazy('./routes/tags'));
  app.use('/api/test-plans',   lazy('./routes/test-plans'));
  app.use('/api/test-runs',    lazy('./routes/test-runs'));
  app.use('/api/git',          lazy('./routes/git'));
  app.use('/api/logs',         lazy('./routes/logs'));
  app.use('/api/probe',        lazy('./routes/probe'));

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
