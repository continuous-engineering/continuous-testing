# BUNDLE A — Electron Shell + Express Scaffold
**Tasks:** A1–A7 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** complete | **Est:** 60min | **Actual:** 45min | **Model:** sonnet

## Plan
- [x] A1 — package.json with all npm dependencies (Size: S)
- [x] A2 — main.js — BrowserWindow, lifecycle, free-port detection (Size: M)
- [x] A3 — preload.js — contextBridge for IPC channels (Size: XS)
- [x] A4 — src/store.js — YAML load/save abstraction (Size: S)
- [x] A5 — src/workspace.js — WS class + path helpers (Size: S)
- [x] A6 — src/server.js + src/helpers.js — Express factory (Size: S)
- [x] A7 — electron-builder NSIS config (in package.json) (Size: XS)

## Execution Log

### A1 — package.json
electron@33, express@4, js-yaml@4, portfinder, simple-git@3, uuid@9, @xenova/transformers@2.
electron-builder target: nsis x64. asarUnpack for @xenova/transformers (ONNX native binaries can't run inside asar).

### A2 — main.js
portfinder scans 8000–9000 for a free port. Express binds to 127.0.0.1 only (not LAN-exposed).
BrowserWindow waits ready-to-show before displaying. DevTools auto-open in dev mode.

### A3 — preload.js
contextBridge exposes: onScorerProgress, onScorerReady, getWorkspacePath.
contextIsolation: true, nodeIntegration: false — renderer has zero direct Node access.

### A4 — src/store.js
load() catches all errors → {}. save() auto-creates parent dirs.
list() / listDirs() return [] on missing dir. appendLog() for .log files.

### A5 — src/workspace.js
getWorkspacesDirectory(): app.getPath('userData') when packaged, ./workspaces in dev.
Full WS class: agentFile(), agentTestFile(), workspaceTestFile(), logFile().

### A6 — src/server.js + src/helpers.js
getProject() mirrors Python get_project(): validates X-Project header, falls back to first workspace dir.
server.js mounts all 11 route modules. Stubs return [] or 501 — no crashes.

### A7 — electron-builder config
NSIS one-click, perMachine: false, desktop + start menu shortcuts.
workspaces/ excluded from bundle. @xenova/transformers asarUnpacked.

## Files Changed
- package.json, main.js, preload.js
- src/store.js, src/workspace.js, src/helpers.js, src/server.js
- src/routes/*.js (11 stubs)

## Blockers — (none)

## Decisions
- Express on loopback 127.0.0.1, dynamic port 8000–9000 — no IPC needed to pass port to renderer (just loadURL)
- contextBridge minimal: scorer events + workspace path. All API traffic stays HTTP — app.js unchanged
- Dev workspaces at project root; prod at userData/workspaces — survives app updates
- Route stubs already wired in server.js — B/C only fill implementations, no mount changes needed
- @xenova/transformers asarUnpacked — ONNX .node binaries require filesystem access
