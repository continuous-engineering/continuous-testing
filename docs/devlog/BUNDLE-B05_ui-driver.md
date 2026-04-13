# BUNDLE B05 — UI Step Driver + Runner Package
**Tasks:** #029, #030, #031
**Started:** 2026-04-13 | **Started-At:** 2026-04-13T23:00:00
**Status:** in_progress | **Est:** 105min | **Model:** sonnet

## Plan
- [ ] #029 — Playwright UI step driver (L=60m)
- [ ] #030 — json-server mock (M=30m)
- [ ] #031 — Runner Docker image (M=30m)

## Execution Log

## Files Changed

## Decisions
- ARCHITECTURAL CORRECTION from B04: executor belongs in standalone runner package, NOT in web app
- runner/ is a separate Node.js package at project root (sibling to web/)
- web/lib/execution/* moved to runner/src/ — web app only enqueues + receives results
- Playwright runs in runner Docker container — isolated from Next.js process
- json-server runs as a child process within the runner container (ephemeral per DAG run)
- Runner Dockerfile: FROM mcr.microsoft.com/playwright:v1.48.0-focal (Chromium bundled)
