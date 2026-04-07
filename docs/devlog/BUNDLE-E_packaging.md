# BUNDLE E — Packaging & Distribution
**Tasks:** E1–E4 | **Started:** 2026-04-07 | **Started-At:** 2026-04-07T00:00:00
**Status:** in_progress | **Est:** 60min | **Model:** sonnet

## Plan
- [ ] E1 — electron-builder NSIS config already in package.json — verify + add icon placeholder (Size: XS)
- [ ] E2 — userData workspace migration on first launch in main.js (Size: S)
- [ ] E3 — electron-updater scaffold (Size: S)
- [ ] E4 — .gitignore update, build script, smoke test checklist (Size: S)

## Execution Log

## Files Changed

## Blockers — (none)

## Decisions
- Migration copies ./workspaces to userData/workspaces only if userData/workspaces doesn't exist yet
- One-time migration flag: userData/.migrated sentinel file
- electron-updater added as dependency, feed URL stubbed in package.json
- Build script: npm run build → dist/AgentTestManager-Setup-x.x.x.exe
