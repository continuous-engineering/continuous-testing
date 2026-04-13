# BUNDLE B01 — Foundation
**Tasks:** #001, #002, #003, #004, #005, #006, #007
**Started:** 2026-04-13 | **Started-At:** 2026-04-13T00:00:00
**Finished:** 2026-04-13 | **Status:** complete | **Actual:** ~3h | **Model:** sonnet

## Plan
- [x] #001 — Next.js App Router scaffold (M)
- [x] #002 — Design token system (M) — globals.css + tailwind.config.ts
- [x] #003 — Core UI components (L) — DenseTable, StepStatusBadge, Sidebar, TopNav, ThemeToggle
- [x] #004 — PostgreSQL pool + SQL query abstraction (S) — lib/db/client.ts + query.ts
- [x] #005 — node-pg-migrate setup (XS) — migrate:up/down scripts
- [x] #006 — Clerk multi-tenant auth (M) — middleware.ts, lib/auth.ts, ClerkProvider
- [x] #007 — Multi-tenant RLS (M) — RLS policies in all 8 migrations

## Execution Log

### Tasks 001-005 — Scaffold, Design System, DB
- Next.js 15, TypeScript strict, Tailwind 4. Design tokens in globals.css, tailwind.config.ts.
- lib/db/client.ts (pg Pool singleton), lib/db/query.ts (query/one/tx/raw — no ORM).
- node-pg-migrate wired. Migrations 001-008 written, RLS on every table.
- Build passes: typecheck clean, npm run build passes.

### Tasks 006-007 — Clerk Auth + RLS
- middleware.ts: clerkMiddleware, public routes, orgId → x-tenant-id header.
- lib/auth.ts: getTenant(), tenantSQLVar() for SET LOCAL app.tenant_id per request.
- Shell pages: export const dynamic = 'force-dynamic' (Clerk requires runtime).

### Invisible UI Mantra
- Written to web/CLAUDE.md as permanent design constraint.
- StepStatusBadge = single canonical status renderer. Semantic colors = constants, not choices.

## Files Changed
- web/app/ (layout, login, shell layout + page stub)
- web/middleware.ts, lib/auth.ts, lib/db/*, lib/utils.ts
- web/components/layout/* (Sidebar, TopNav, ThemeToggle)
- web/components/data/DenseTable.tsx, components/domain/StepStatusBadge.tsx
- web/styles/globals.css, tailwind.config.ts, tsconfig.json, next.config.ts, package.json
- web/migrations/001-008.sql, web/.gitignore, web/.env.example, web/CLAUDE.md
- docs/adrs/001-runner-model.md, docs/adrs/002-usage-billing.md

## Blockers — (none)

## Decisions
- typedRoutes disabled — breaks dynamic sidebar hrefs
- dynamic = force-dynamic on shell pages — Clerk needs runtime context
- .env.local gitignored — real Clerk key required for dev
- RLS via SET LOCAL per request — connection pool is shared, not per-tenant
- runs_on on pipeline only (ADR-001), usage_ledger append-only (ADR-002)
