const path = require('path');
const fs = require('fs');

function getSettingsPath() {
  try {
    const { app } = require('electron');
    return path.join(app.getPath('userData'), 'settings.json');
  } catch {
    return path.join(__dirname, '..', '.settings.json');
  }
}

function load() {
  try {
    return JSON.parse(fs.readFileSync(getSettingsPath(), 'utf8'));
  } catch {
    return {};
  }
}

function save(data) {
  const filePath = getSettingsPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const merged = { ...load(), ...data };
  fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));
  return merged;
}

module.exports = { load, save };
