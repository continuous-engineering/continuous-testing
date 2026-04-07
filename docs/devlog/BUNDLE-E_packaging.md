# BUNDLE E — Packaging & Distribution
**Tasks:** E1–E4 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** complete | **Est:** 60min | **Actual:** 25min | **Model:** sonnet

## Plan
- [x] E1 — electron-builder NSIS config already in package.json — verify + add icon placeholder (Size: XS)
- [x] E2 — userData workspace migration on first launch in main.js (Size: S)
- [x] E3 — electron-updater scaffold (Size: S)
- [x] E4 — .gitignore update, build script, smoke test checklist (Size: S)

## Execution Log

### E1 — NSIS config + build/ dir
NSIS config confirmed in package.json: oneClick, desktop + start menu shortcuts, x64 target.
build/ dir created with README.md — icon.ico must be placed here before `npm run build`.
extraResources: workspaces/ copied to app/workspaces in installer (excluding results/ and logs/).

### E2 — userData migration (main.js)
migrateWorkspacesIfNeeded() runs at app.whenReady before Express starts.
Guard: isDev → skip (dev always uses ./workspaces). Sentinel: userData/.migrated file.
Source: resources/app/workspaces (bundled in installer via extraResources).
Dest: userData/workspaces. If source missing, creates empty _global/test-cases/ structure.

### E3 — electron-updater
Added electron-updater@6 to dependencies. publish.url stub in package.json.
autoUpdater call commented out in main.js — activate when release feed is live.

### E4 — .gitignore + smoke test
.gitignore: added node_modules/, dist/, .migrated, npm-debug.log*.
docs/SMOKE_TEST.md: 3-section checklist (dev, packaged installer, regression).

## Files Changed
- package.json (electron-updater dep, publish config, extraResources, additional scripts)
- main.js (migrateWorkspacesIfNeeded, auto-updater stub)
- .gitignore (node_modules, dist, .migrated)
- build/README.md (icon instructions)
- docs/SMOKE_TEST.md (smoke test checklist)

## Blockers — (none)

## Decisions
- Workspace migration is one-time (sentinel file) — safe to run multiple app updates without clobbering user data
- extraResources bundles workspaces/ into the installer so new users get sample test data on first install
- Auto-updater commented out — activate by uncommenting when publish.url points to a live feed
- E4 is a checklist, not automated — actual build test requires a Windows machine with electron-builder
