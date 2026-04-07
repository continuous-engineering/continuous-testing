# BUNDLE A — Electron Shell + Express Scaffold
**Tasks:** A1–A7 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** in_progress | **Est:** 60min | **Model:** sonnet

## Plan
- [ ] A1 — package.json with all npm dependencies (Size: S)
- [ ] A2 — main.js — BrowserWindow, lifecycle, free-port detection (Size: M)
- [ ] A3 — preload.js — contextBridge for IPC channels (Size: XS)
- [ ] A4 — src/store.js — YAML load/save abstraction (Size: S)
- [ ] A5 — src/workspace.js — WS class + path helpers (Size: S)
- [ ] A6 — src/server.js + src/helpers.js — Express factory (Size: S)
- [ ] A7 — electron-builder NSIS config (in package.json) (Size: XS)

## Execution Log

## Files Changed

## Blockers — (none)

## Decisions
- Express runs in main process on a dynamically allocated port (portfinder); port passed to BrowserWindow via loadURL
- contextBridge exposes only scorer IPC + workspace-path — no broad Node access from renderer
- In dev mode: workspaces/ resolved relative to project root. In prod: app.getPath('userData')/workspaces
- Route files are stubs in Bundle A; real implementations in Bundles B/C
- server.js uses require() for routes only after they exist — stubs return [] or {} to avoid crashes
