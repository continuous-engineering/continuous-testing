const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const store = {
  /**
   * Load a YAML file. Returns {} if missing or unparseable — never throws.
   */
  load(filePath) {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      return yaml.load(content) || {};
    } catch {
      return {};
    }
  },

  /**
   * Save data as YAML. Creates parent directories automatically.
   */
  save(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, yaml.dump(data, { lineWidth: -1 }), 'utf8');
  },

  exists(filePath) {
    return fs.existsSync(filePath);
  },

  delete(filePath) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  },

  /**
   * List all .yaml files in a directory. Returns [] if dir missing.
   */
  list(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(f => f.endsWith('.yaml'))
      .map(f => path.join(dir, f));
  },

  /**
   * List immediate subdirectories of a directory. Returns [] if missing.
   */
  listDirs(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
      .filter(name => {
        try {
          return fs.statSync(path.join(dir, name)).isDirectory();
        } catch {
          return false;
        }
      });
  },

  /**
   * Append a line to a text log file. Creates parent dirs automatically.
   */
  appendLog(filePath, line) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, line + '\n', 'utf8');
  },

  readText(filePath) {
    try {
      return fs.readFileSync(filePath, 'utf8');
    } catch {
      return null;
    }
  },
};

module.exports = store;
