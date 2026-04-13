# BUNDLE B01 — Foundation
**Tasks:** #001, #002, #003, #004, #005, #006, #007
**Started:** 2026-04-13 | **Started-At:** 2026-04-13T00:00:00
**Status:** in_progress | **Est:** 185min | **Model:** sonnet

## Plan
- [ ] #001 — Next.js App Router scaffold — TS strict, Tailwind, shadcn/ui, ESLint (M=30m)
- [ ] #002 — Design token system — CSS custom props, Emerald palette, dark/light/system (M=30m)
- [ ] #003 — Core UI components — DenseTable, StatusBadge, AppShell, Sidebar, TopNav, ThemeToggle (L=60m)
- [ ] #004 — PostgreSQL pool + SQL query abstraction — query/one/tx, .sql loader (S=15m) [DONE in scaffold]
- [ ] #005 — node-pg-migrate setup + migrate scripts (XS=5m) [DONE in scaffold]
- [ ] #006 — Clerk multi-tenant auth — middleware, tenant context (M=30m)
- [ ] #007 — Multi-tenant RLS — policies, tenant_id on all tables (M=30m)

## Execution Log

## Files Changed

## Blockers — (none)

## Decisions
- Scaffold already created: web/package.json, lib/db/client.ts, lib/db/query.ts, styles/globals.css, migrations 001-004
- Tasks 004 + 005 partially done — complete remaining migrations (005-008) and verify
- web/ is a subdirectory of the existing Electron repo (monorepo pattern)
- All Next.js work lives in web/ — CLAUDE.md for web app to be created as web/CLAUDE.md
