/**
 * Semantic similarity scorer using local embeddings.
 * Model: Xenova/all-MiniLM-L6-v2 (~23MB ONNX, CPU-only).
 *
 * Usage:
 *   const scorer = require('./scorer');
 *   await scorer.init(onProgress);  // warm up (optional — lazy on first score)
 *   const sim = await scorer.score(expected, actual);  // 0.0 – 1.0
 *
 * Falls back to keyword overlap if the model is not yet loaded.
 */

let pipeline = null;
let loading = false;
let loadListeners = [];
let _onProgress = null;

// Keyword overlap fallback (verbatim Python port)
function keywordScore(expected, actual) {
  if (!expected) return 1.0;
  if (!actual) return 0.0;
  const words = s => new Set((s.toLowerCase().match(/\b\w{4,}\b/g) || []));
  const exp = words(expected);
  if (!exp.size) return 1.0;
  const act = words(actual);
  let overlap = 0;
  for (const w of exp) if (act.has(w)) overlap++;
  return overlap / exp.size;
}

function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

async function loadModel() {
  if (pipeline) return;
  if (loading) {
    return new Promise((resolve, reject) => loadListeners.push({ resolve, reject }));
  }

  loading = true;
  try {
    const { pipeline: createPipeline, env } = await import('@xenova/transformers');

    // Cache model in <data-folder>/.models/ — alongside project repos
    try {
      const path = require('path');
      const { getWorkspacesDirectory } = require('./workspace');
      env.cacheDir = path.join(getWorkspacesDirectory(), '..', '.models');
    } catch {
      // Fallback: userData/models
      try {
        const { app } = require('electron');
        const path = require('path');
        env.cacheDir = path.join(app.getPath('userData'), '.models');
      } catch { /* use default */ }
    }

    // Progress callback
    const progressCb = _onProgress
      ? (info) => {
          if (info.status === 'downloading' && typeof info.progress === 'number') {
            _onProgress(Math.round(info.progress));
          }
        }
      : undefined;

    pipeline = await createPipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      progress_callback: progressCb,
      quantized: true,
    });

    loadListeners.forEach(l => l.resolve());
  } catch (err) {
    loading = false;
    loadListeners.forEach(l => l.reject(err));
    loadListeners = [];
    throw err;
  }

  loading = false;
  loadListeners = [];
}

const scorer = {
  isReady() { return pipeline !== null; },

  /**
   * Warm up the model. Call from main.js at startup.
   * onProgress(pct: number) called during model download.
   */
  async init(onProgress) {
    _onProgress = onProgress || null;
    await loadModel();
  },

  /**
   * Score semantic similarity between expected and actual strings.
   * Returns 0.0–1.0. Falls back to keyword score if model not ready.
   */
  async score(expected, actual) {
    if (!expected) return 1.0;
    if (!actual) return 0.0;

    if (!pipeline) {
      // Try to load; if it fails or times out, fall back
      try {
        await Promise.race([
          loadModel(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500)),
        ]);
      } catch {
        return keywordScore(expected, actual);
      }
    }

    if (!pipeline) return keywordScore(expected, actual);

    try {
      const [embExp, embAct] = await Promise.all([
        pipeline(expected, { pooling: 'mean', normalize: true }),
        pipeline(actual,   { pooling: 'mean', normalize: true }),
      ]);
      return cosine(Array.from(embExp.data), Array.from(embAct.data));
    } catch {
      return keywordScore(expected, actual);
    }
  },

  keywordScore, // exported for tests
};

module.exports = scorer;
