# AI-Test — Agent Continous.Testing (Electron)

Desktop app for testing AI agents. Testers download one installer and run — no Python, no Node.js, no CLI required.

## Stack

- **Shell:** Electron 33 (main process + Chromium renderer)
- **Backend:** Express 4 running in Electron main process (no separate server)
- **Storage:** YAML files via `js-yaml` (no database)
- **Frontend:** Vanilla HTML/JS/CSS in `static/` — zero build step, zero changes from original
- **Git ops:** `simple-git` npm package
- **Semantic scoring:** `@xenova/transformers` (local embeddings, model cached in userData)
- **Packaging:** `electron-builder` → Windows NSIS installer (`.exe`)

## Build Commands

- **Check:**  `npm run lint`
- **Build:**  `npm run build` (electron-builder, outputs to `dist/`)
- **Test:**   `npm test` (none defined yet)
- **Dev:**    `npm start` (launches Electron in dev mode with DevTools)
- **Deploy:** Manual — distribute `dist/*.exe` installer

## Project Layout

```
package.json
main.js                    # Electron entry — BrowserWindow, app lifecycle, IPC
src/
  server.js                # Express app factory — mounts all routers
  store.js                 # YAML read/write (mirrors Python Store)
  workspace.js             # WS class — path helpers for workspaces/agents/tests
  scorer.js                # Semantic scoring via @xenova/transformers
  routes/
    projects.js            # GET/POST/DELETE /api/projects
    agents.js              # CRUD /api/agents
    test-cases.js          # CRUD /api/test-cases + agent-scoped variants
    test-plans.js          # CRUD /api/test-plans
    test-runs.js           # POST /api/test-runs, GET poll
    environments.js        # CRUD /api/environments
    git.js                 # status, info, commit, sync, push, smart-commit
    dashboard.js           # GET /api/dashboard
    logs.js                # GET/DELETE /api/logs/:type
    probe.js               # POST /api/probe
static/
  index.html               # Unchanged from original
  app.js                   # Unchanged from original
  styles.css               # Unchanged from original
workspaces/                # User data — GITIGNORED for results/ and logs/
dist/                      # electron-builder output — GITIGNORED
```

## Storage Layout

**One file per entity** — never a list inside a single file.
**suite_type is a field inside each test YAML** — not encoded in the directory path.

```
workspaces/
  _global/
    test-cases/
      <test_id>.yaml             # suite_type: functional | security

  <project>/
    agents/
      <agent_id>/
        agent.yaml
        test-cases/
          <test_id>.yaml
    test-cases/
      <test_id>.yaml
    results/runs.yaml            # GITIGNORED
    logs/                        # GITIGNORED
    config/
      environments.yaml
      tags.yaml
      test_plans.yaml
```

**Test collection order:** global → workspace → agent. Each result carries `_source`.

**Reserved names:** `_global` (project), `_shared` (legacy — do not create).

## Key Conventions

- `store.load(path)` returns `{}` if file missing — never throws on missing file
- `store.save(path, data)` — creates parent dirs automatically
- All route handlers are thin: load → transform → respond
- Workspace path in production: `app.getPath('userData')/workspaces` — NOT beside the `.exe`
- Workspace path in dev: `./workspaces` (relative to project root)
- Active project passed via `X-Project` request header (unchanged from original)
- Semantic scorer lazy-loads — model downloads once on first use, cached in `app.getPath('userData')/models`
- `_keyword_score` removed — replaced by cosine similarity from sentence embeddings

## Electron IPC (non-API channels)

| Channel | Direction | Purpose |
|---|---|---|
| `scorer:ready` | main → renderer | Phi model finished loading |
| `scorer:progress` | main → renderer | Model download % |
| `app:workspace-path` | main → renderer | Path to workspaces dir (shown in UI) |

## Packaging Notes

- `electron-builder` target: `nsis` (Windows installer)
- `workspaces/` is NOT bundled — lives in `userData` so it survives app updates
- Model file (`~400MB`) downloaded on first launch, not bundled in installer
- Sign with `CSC_LINK` / `CSC_KEY_PASSWORD` env vars for Windows code signing

## Gotchas

- **userData path:** never use `__dirname` for workspace path in production — use `app.getPath('userData')`
- **Preload script required:** renderer cannot use `require()` — all Node access goes through `contextBridge`
- **Express port:** pick a random available port at startup (use `portfinder` or bind to `0`); pass port to renderer via IPC before loading the URL
- **YAML_AVAILABLE guard:** removed — `js-yaml` is a hard dependency, not optional
- **Emoji safe:** no restrictions on Node.js stdout encoding (unlike Python cp1252)
