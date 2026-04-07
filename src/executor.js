/**
 * Agent test execution engine.
 * Ported from Python server.py _call_agent_sync + _execute_test.
 * Uses native Node.js fetch (Node 18+).
 * Scoring: semantic embeddings via scorer.js (falls back to keyword overlap).
 */

const scorer = require('./scorer');
const DEFAULT_BODY_TEMPLATE = '{"messages": [{"role": "user", "content": "{{message}}"}]}';

function buildAuthHeaders(agent) {
  const { auth_type, auth_value = '', auth_header = '' } = agent;
  if (auth_type === 'bearer' && auth_value)
    return { Authorization: `Bearer ${auth_value}` };
  if (auth_type === 'basic' && auth_value)
    return { Authorization: `Basic ${Buffer.from(auth_value).toString('base64')}` };
  if (auth_type === 'api_key' && auth_value)
    return { [auth_header || 'X-API-Key']: auth_value };
  return {};
}

function buildRequestBody(prompt, bodyTemplate) {
  const template = (bodyTemplate || DEFAULT_BODY_TEMPLATE).trim();
  const jsonStr = JSON.stringify(prompt);
  const bodyStr = template.replace(/"?\{\{\s*message\s*\}\}"?/g, jsonStr);
  try {
    JSON.parse(bodyStr);
    return bodyStr;
  } catch {
    return JSON.stringify({ messages: [{ role: 'user', content: prompt }] });
  }
}

function walkPath(obj, dotPath) {
  for (const key of dotPath.split('.')) {
    if (obj == null) return null;
    if (Array.isArray(obj)) {
      const i = parseInt(key, 10);
      obj = isNaN(i) ? null : obj[i];
    } else if (typeof obj === 'object') {
      obj = obj[key];
    } else {
      return null;
    }
  }
  return obj;
}

function extractResponseText(raw, responsePath = '') {
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return raw; }

  if (responsePath) {
    const val = walkPath(parsed, responsePath.trim());
    if (val != null) return typeof val === 'string' ? val : JSON.stringify(val, null, 2);
  }

  // OpenAI Chat Completions
  const choices = parsed.choices;
  if (Array.isArray(choices) && choices.length) {
    const msg = choices[0].message;
    if (msg?.content) return msg.content;
    if (choices[0].text) return choices[0].text;
  }

  // Common single fields
  for (const field of ['response', 'message', 'content', 'answer', 'output', 'text', 'result', 'reply']) {
    if (typeof parsed[field] === 'string' && parsed[field]) return parsed[field];
  }

  // Nested wrappers
  for (const wrapper of ['data', 'result', 'output']) {
    const nested = parsed[wrapper];
    if (nested && typeof nested === 'object') {
      for (const field of ['response', 'message', 'content', 'text', 'answer']) {
        if (typeof nested[field] === 'string' && nested[field]) return nested[field];
      }
    }
  }

  return raw;
}

/**
 * Call an agent endpoint and return { text, raw, elapsedMs, error }.
 */
async function callAgent(endpoint, prompt, extraHeaders = {}, bodyTemplate = null, responsePath = '') {
  const target = endpoint.replace(/\/$/, '');
  const body = buildRequestBody(prompt, bodyTemplate);
  const headers = { 'Content-Type': 'application/json', ...extraHeaders };
  const start = Date.now();

  try {
    const resp = await fetch(target, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });
    const raw = await resp.text();
    const elapsedMs = Date.now() - start;
    if (!resp.ok) {
      const err = `HTTP ${resp.status}: ${raw.slice(0, 400)}`;
      return { text: '', raw: '', elapsedMs, error: err };
    }
    const text = extractResponseText(raw, responsePath);
    return { text, raw, elapsedMs, error: null };
  } catch (e) {
    return { text: '', raw: '', elapsedMs: Date.now() - start, error: e.message };
  }
}

/**
 * Execute a single test against an agent. Returns a result object.
 */
async function executeTest(agent, test) {
  const endpoint = (agent.endpoint || '').trim();
  const prompt = test.user_prompt || '';
  const expected = test.expected_response || '';
  const source = test._source || 'agent';

  const base = {
    test_id: test.test_id,
    test_name: test.test_name || '',
    expected_response: expected,
    _source: source,
  };

  if (!endpoint) {
    return { ...base, status: 'error', error: 'No endpoint configured', score: 0, latency_ms: 0, actual_response: '' };
  }

  const { text, elapsedMs, error } = await callAgent(
    endpoint, prompt,
    buildAuthHeaders(agent),
    agent.body_template,
    agent.response_path || ''
  );

  if (error) {
    return { ...base, status: 'error', error, score: 0, latency_ms: Math.round(elapsedMs), actual_response: '' };
  }

  const score = await scorer.score(expected, text);
  const latencyOk = elapsedMs <= (test.expected_latency_ms || 5000);
  const passed = score >= (test.min_semantic_match || 0.75) && latencyOk;

  return {
    ...base,
    status: passed ? 'pass' : 'fail',
    score: Math.round(score * 1000) / 1000,
    latency_ms: Math.round(elapsedMs * 10) / 10,
    latency_ok: latencyOk,
    actual_response: text.slice(0, 1500),
  };
}

/**
 * Build a complete run record for one agent + suite.
 */
async function buildRunRecord(agent, suiteType, tests, configId = null, configName = null) {
  const runId = require('crypto').randomBytes(6).toString('hex');
  const startedAt = new Date().toISOString();

  const results = await Promise.all(tests.map(t => executeTest(agent, t)));

  const endedAt = new Date().toISOString();
  const duration = (new Date(endedAt) - new Date(startedAt)) / 1000;
  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const errors = results.filter(r => r.status === 'error').length;

  const run = {
    run_id: runId,
    agent_id: agent.agent_id,
    agent_name: agent.name || agent.agent_id,
    suite_type: suiteType,
    status: 'completed',
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: Math.round(duration * 100) / 100,
    summary: { passed, failed, errors, total: results.length },
    pass_rate: results.length ? Math.round(passed / results.length * 1000) / 1000 : 0,
    results,
  };

  if (configId) { run.config_id = configId; run.config_name = configName || ''; }
  return run;
}

module.exports = { executeTest, buildRunRecord, callAgent, buildAuthHeaders, scorer };
