# Bundle Plan — AI-Test Agent Test Manager (Electron)

Migration from Python/Starlette to pure Electron + Node.js/Express.
Goal: single `.exe` installer, zero prerequisites for testers.

---

## Bundle A — Electron Shell + Express Scaffold

**Goal:** Working Electron window that loads the existing static frontend via an Express server running inside the main process. No Python. No port conflicts. DevTools in dev mode.

**Deliverables:**
- `package.json` with all dependencies and electron-builder config
- `main.js` — BrowserWindow lifecycle, free-port detection, loads `http://localhost:<port>`
- `preload.js` — contextBridge exposing IPC channels
- `src/store.js` — `load(path)` / `save(path, data)` using `js-yaml`
- `src/workspace.js` — `WS` class with all path helpers, userData-aware
- `src/server.js` — Express factory, mounts static/ and all routers
- electron-builder NSIS config stub

**Dependencies:** electron, express, js-yaml, uuid, portfinder, electron-builder

**Exit criteria:** `npm start` opens a window showing the existing UI. All pages render. API calls 404 (routes not yet wired) but no crashes.

---

## Bundle B — Core API Routes (Projects, Agents, Tests)

**Goal:** All CRUD operations for the three main entities fully working. Tester can create a workspace, add agents, and manage test cases.

**Deliverables:**
- `src/routes/projects.js`
- `src/routes/agents.js`
- `src/routes/test-cases.js` (all 3 scope levels: global, workspace, agent)
- `src/routes/environments.js`
- `src/routes/tags.js`
- `src/routes/dashboard.js`

**Dependencies:** Bundle A complete

**Exit criteria:** Full CRUD round-trip verified in the running app. Existing `workspaces/e360` data loads correctly.

---

## Bundle C — Test Execution, Git, Logs

**Goal:** Testers can run test plans and see results. Git commit/push/sync works against the workspaces directory.

**Deliverables:**
- `src/routes/test-plans.js`
- `src/routes/test-runs.js` — async execution with status polling
- `src/routes/probe.js`
- `src/routes/git.js` — all 6 operations via `simple-git`
- `src/routes/logs.js`

**Dependencies:** Bundle B complete, `simple-git` installed

**Exit criteria:** Can run a test plan end-to-end. Results persist. Git status/commit/push works on the workspaces directory.

---

## Bundle D — Semantic Scoring (Local Embeddings)

**Goal:** Replace naive keyword-overlap scoring with real semantic similarity using a local embedding model. No internet required at test time — model cached after first download.

**Deliverables:**
- `src/scorer.js` — `score(expected, actual)` → float 0–1 using cosine similarity
- Model: `Xenova/all-MiniLM-L6-v2` (ONNX, ~23MB, no GPU needed)
- IPC: `scorer:progress` (download %), `scorer:ready`
- UI badge in sidebar showing scorer status

**Dependencies:** Bundle C complete, `@xenova/transformers` installed

**Exit criteria:** Test results show real semantic scores. Score for a semantically matching pair is >0.7. UI shows "AI Scorer: ready" after model loads.

---

## Bundle E — Packaging & Distribution

**Goal:** Single `.exe` that any tester can download, install, and run. Workspaces survive app updates.

**Deliverables:**
- `electron-builder` NSIS config (one-click install, desktop shortcut)
- First-launch migration: copy `./workspaces` → `userData/workspaces` if present
- `electron-updater` stub for future auto-update feed
- `npm run build` produces `dist/AgentTestManager-Setup-x.x.x.exe`
- Build + smoke test checklist

**Dependencies:** Bundle D complete

**Exit criteria:** Fresh Windows machine, install the `.exe`, launch, create workspace, add agent, run test, see result — no terminal ever opened.
