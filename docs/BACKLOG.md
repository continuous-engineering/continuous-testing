# Backlog — AI-Test Agent Test Manager (Electron)

## Status Legend

| Symbol | Meaning |
|---|---|
| ⬜ | Pending |
| 🔄 | In progress |
| ✅ | Completed |
| ❌ | Blocked / failed |

---

## Bundle A — Electron Shell + Express Scaffold

| # | Status | Task |
|---|---|---|
| A1 | ✅ | Initialize package.json with all npm dependencies |
| A2 | ✅ | Create main.js — BrowserWindow, lifecycle, port IPC |
| A3 | ✅ | Create preload.js — contextBridge API surface |
| A4 | ✅ | Create src/store.js — YAML read/write abstraction |
| A5 | ✅ | Create src/workspace.js — WS path helper class |
| A6 | ✅ | Create src/server.js + src/helpers.js — Express factory |
| A7 | ✅ | Wire up electron-builder config in package.json |

---

## Bundle B — Core API Routes (Projects, Agents, Tests)

| # | Status | Task |
|---|---|---|
| B1 | ✅ | src/routes/projects.js — GET/POST/DELETE /api/projects |
| B2 | ✅ | src/routes/agents.js — full CRUD /api/agents |
| B3 | ✅ | src/routes/test-cases.js — all test-case endpoints |
| B4 | ✅ | src/routes/environments.js — CRUD /api/environments |
| B5 | ✅ | src/routes/tags.js — GET/POST /api/tags |
| B6 | ✅ | src/routes/dashboard.js — GET /api/dashboard |

---

## Bundle C — Test Execution, Git, Logs

| # | Status | Task |
|---|---|---|
| C1 | ✅ | src/routes/test-plans.js — CRUD /api/test-plans |
| C2 | ✅ | src/routes/test-runs.js — start + poll test runs |
| C3 | ✅ | src/routes/probe.js — POST /api/probe |
| C4 | ✅ | src/routes/git.js — all 6 git operations |
| C5 | ✅ | src/routes/logs.js — GET/DELETE /api/logs/:type |

---

## Bundle D — Semantic Scoring with Local Embeddings

| # | Status | Task |
|---|---|---|
| D1 | ✅ | Create src/scorer.js — cosine similarity via @xenova/transformers |
| D2 | ✅ | Replace _keyword_score with real embedding comparison |
| D3 | ✅ | IPC channels: scorer:ready, scorer:progress to renderer |
| D4 | ✅ | Add model status indicator to UI |

---

## Bundle E — Packaging & Distribution

| # | Status | Task |
|---|---|---|
| E1 | 🔄 | electron-builder NSIS config — one-click installer |
| E2 | 🔄 | userData workspace migration on first launch |
| E3 | 🔄 | Auto-updater scaffold (electron-updater) |
| E4 | 🔄 | Build + smoke test installer end-to-end |
