# Bundle Plan — continuous.testing SaaS Platform

> Greenfield SaaS build. Bundles ordered by dependency wave.
> Parallel execution: bundles within the same wave run concurrently, one agent per bundle.
> A bundle is NOT done until: build passes, types clean, no debug output, devlog entry written, committed + pushed.

---

## Dependency Graph

```
Wave 1:  B01 (Foundation)
         B13 (Website) — can start with design tokens only, runs independently
         
Wave 2:  B02 (Schema)          ← needs B01
         B13 continues

Wave 3:  B03 (Core Data APIs)  ← needs B02
         B13 continues

Wave 4:  B04 (Execution Core)  ← needs B03
         B12 (Settings UI)     ← needs B03

Wave 5:  B05 (UI Driver)       ← needs B04
         B06 (Pipeline UI)     ← needs B04
         B09 (Analytics)       ← needs B04
         B10 (Issues Hub)      ← needs B04
         B11 (CI/CD + Notify)  ← needs B04
         B14 (Self-hosted Runner) ← needs B04

Wave 6:  B07 (Browser Recording) ← needs B05 + B06
         B08 (Import + Intelligence) ← needs B06
```

---

## B01 — Foundation
**Wave:** 1 | **Deps:** None | **Tasks:** 001–007 | **Est:** 6–8 days
**Partial scaffold exists in `web/`:** package.json, lib/db/client.ts, lib/db/query.ts, styles/globals.css, migrations 001–004. Continue from here — do not recreate.

The project zero. Nothing else can start until this is done.

**Goal:** Running Next.js app with auth, multi-tenancy, database connection, design system, and theme switching. A logged-in user can see a shell with sidebar — no features yet, but the skeleton is solid.

**Tasks:**
- 001 — Next.js App Router scaffold
- 002 — Design token system (Emerald, dark/light/system)
- 003 — Core UI components (DenseTable, StatusBadge, AppShell, Sidebar, TopNav, ThemeToggle)
- 004 — PostgreSQL pool + SQL query abstraction
- 005 — node-pg-migrate setup
- 006 — Clerk multi-tenant auth
- 007 — RLS policies (tenant isolation)

**Internal order:** 001 → 002 → 003 (parallel with 004 → 005) → 006 → 007

**Exit criteria:**
- `npm run dev` opens authenticated shell, dark/light/system toggle works
- Org creation flow works, tenant_id propagates to DB queries
- `npm run migrate:up` runs clean against a fresh Postgres instance
- RLS verified: user from tenant A cannot read tenant B's rows

---

## B02 — Database Schema
**Wave:** 2 | **Deps:** B01 | **Tasks:** 008–015 | **Est:** 3–4 days

All 8 migrations in sequence. Can be one PR — migration files are independent files but run in order.

**Tasks:**
- 008 — tenants, projects, memberships
- 009 — pipelines + steps (JSONB config, prerequisites[], outputs[])
- 010 — environments + secrets
- 011 — runs, run_results, ctx_snapshots
- 012 — issues, issue_refs, sync_log
- 013 — runners, runner_jobs
- 014 — datasets, dataset_rows
- 015 — openapi_specs, coverage_snapshots

**Exit criteria:**
- All migrations run clean, roll back clean
- `step.type` enum: `api | ui | ai`
- `step.config` JSONB validates on insert via check constraint
- `secrets.encrypted_value` never null
- All tables have `tenant_id`, `created_at`, `updated_at`, `deleted_at` (soft delete)

---

## B03 — Core Data APIs
**Wave:** 3 | **Deps:** B02 | **Tasks:** 016–021 | **Est:** 4–5 days

All 6 entity CRUD APIs. All parallel — no inter-dependencies.

**Tasks:**
- 016 — Projects API
- 017 — Pipelines API (DAG cycle detection on save)
- 018 — Steps API (type-specific config validation)
- 019 — Environments API
- 020 — Secrets vault API
- 021 — Datasets API

**Pattern for every route:**
```
app/api/<entity>/route.ts         → collection (GET list, POST create)
app/api/<entity>/[id]/route.ts    → item (GET, PATCH, DELETE)
lib/queries/<entity>/             → .sql files only
```

**Exit criteria:**
- All endpoints return correct shapes, 404 on missing, 403 on wrong tenant
- Secrets: POST stores encrypted, GET returns `{ id, name, created_at }` — no value field ever
- Pipeline save rejects a step DAG with cycles (HTTP 422)
- CSV upload creates dataset rows correctly

---

## B04 — Execution Engine Core
**Wave:** 4 | **Deps:** B03 | **Tasks:** 022–028 | **Est:** 6–8 days
**ADR refs:** ADR-001 (runner model), ADR-002 (billing)
**Key constraints:**
- `runs_on` on pipeline only — no per-step runner routing (ADR-001)
- `FOR UPDATE SKIP LOCKED` on job claim — concurrent runners safe
- `runner_minutes` written to `usage_ledger` on every run completion (ADR-002)
- Hosted scope billed, self-hosted scope tracked only

The heart of the platform. Sequential internal dependencies — build in order.

**Tasks:**
- 022 — BullMQ queue setup
- 023 — Runner registration + auth
- 024 — Job claim + context injection
- 025 — DAG executor (topological sort, wave execution)
- 026 — API step driver
- 027 — AI step driver
- 028 — SSE run streaming

**Internal order:** 022 → 023 → 024 → 025 → 026 (parallel with 027) → 028

**Exit criteria:**
- Runner registers, gets token, polls queue, claims job
- Context delivered: env vars + decrypted secrets in memory only
- DAG executes correct wave order, fan-in steps wait for all prerequisites
- API step: all HTTP methods, status/header/body assertions pass/fail correctly
- AI step: Claude call proxied, score compared to threshold, pass/fail
- Frontend receives step results in real-time via SSE

---

## B05 — UI Step Driver
**Wave:** 5 | **Deps:** B04 | **Tasks:** 029–031 | **Est:** 4–5 days

Playwright in Docker. json-server mock. Runner image published.

**Tasks:**
- 029 — Playwright UI step driver
- 030 — json-server mock (ephemeral, seeded, middleware toggles)
- 031 — Runner Docker image

**Exit criteria:**
- UI step executes Playwright against a target URL, video + trace uploaded to S3
- json-server spins up with seeded db.json, middleware toggles work (auth/latency/errors)
- `docker run ct-runner` registers with the SaaS, picks up and executes a full DAG

---

## B06 — Pipeline Authoring UI
**Wave:** 5 | **Deps:** B04 | **Tasks:** 032–037 | **Est:** 6–8 days

The primary daily surface for the QA manager. Most used UI in the product.

**Tasks:**
- 032 — Pipeline canvas (linear default, DAG toggle)
- 033 — API step designer
- 034 — UI step designer
- 035 — AI step designer
- 036 — Context binding UI
- 037 — Pipeline run controls + live status

**Exit criteria:**
- QA manager can create a pipeline: API step → UI step → AI step, wired with context bindings
- Run button executes, step cards update status live via SSE
- Context binding dropdown only shows declared upstream outputs (no freetext)
- Selector health indicator shows ARIA/testid/css priority for UI step elements

---

## B07 — Browser Recording
**Wave:** 6 | **Deps:** B05 + B06 | **Tasks:** 038–039 | **Est:** 4–5 days

The recording experience and self-healing selector engine.

**Tasks:**
- 038 — Browser recording session + Claude semantic intent extraction
- 039 — Self-healing selector engine

**Exit criteria:**
- User clicks Record → browser session opens → interactions captured → semantic descriptions generated by Claude
- Each captured action stores: semantic intent + ARIA + testid + text + CSS selectors
- On replay: tries ARIA first, escalates to CSS only as last resort
- UI warns: "3 selectors fell back to CSS — these elements lack accessible labels"

---

## B08 — Import & Intelligence
**Wave:** 6 | **Deps:** B06 | **Tasks:** 040–043 | **Est:** 7–9 days

The biggest differentiator. 042 (git repo analysis) is the XL task.

**Tasks:**
- 040 — OpenAPI spec import
- 041 — HAR file import
- 042 — Git repo + Claude journey map (XL — plan as sub-tasks)
- 043 — Postman collection import

**042 sub-tasks:**
- Clone repo to temp dir
- Parse routes/controllers → endpoint map
- Parse frontend components → user journey candidates
- Claude: generate journey map from codebase analysis
- UI: journey map review (accept/reject per journey)
- Generate test stubs for accepted journeys (API + UI + AI steps)

**Exit criteria:**
- OpenAPI import: all endpoints become draft API steps + realistic mock db.json
- HAR import: captured request/response pairs become API steps with assertions
- Git analysis: repo → journey map → accepted journeys → runnable pipeline stubs
- Postman: collection → pipeline, environment → CT environment

---

## B09 — Dashboard & Analytics
**Wave:** 5 | **Deps:** B04 | **Tasks:** 044–047 | **Est:** 5–6 days

QA manager's daily view. All widgets read from run_results + analytics queries.

**Tasks:**
- 044 — Main dashboard
- 045 — Flaky detection
- 046 — OpenAPI coverage map
- 047 — Snapshot/baseline testing

**Exit criteria:**
- Dashboard loads in < 500ms, shows real run health data for last 24h
- Flaky badge appears on steps with 5–95% fail rate over 5+ runs
- Coverage map shows endpoint coverage %, red on zero-coverage gaps
- Snapshot: second run diffs against first, AI describes changes, approval flow works

---

## B10 — Issues Hub
**Wave:** 5 | **Deps:** B04 | **Tasks:** 048–054 | **Est:** 6–7 days

Internal issues first. Adapters are pluggable — each can ship independently.

**Tasks:**
- 048 — Issues model CRUD + API
- 049 — Auto-issue creation on failure
- 050 — Background sync worker
- 051 — Jira adapter (largest — OAuth2)
- 052 — GitHub Issues adapter
- 053 — Linear adapter
- 054 — Issues list UI

**Internal order:** 048 → 049 → 050 → (051, 052, 053 parallel) → 054

**Exit criteria:**
- Test failure auto-creates issue, dedup works (same step+pipeline = one issue)
- Closed issue reopens if same step fails again
- Jira: create/update/close bidirectional, webhook inbound updates internal status
- Sync worker processes pending sync_log rows every 60s without blocking test runs

---

## B11 — CI/CD & Notifications
**Wave:** 5 | **Deps:** B04 | **Tasks:** 055–060 | **Est:** 3–4 days

Webhook trigger is the critical path. Notification adapters are independent.

**Tasks:**
- 055 — Webhook trigger endpoint
- 056 — GitHub Actions action
- 057 — Notification adapter system
- 058 — Slack adapter
- 059 — Email adapter (Resend)
- 060 — Outbound webhook adapter

**Exit criteria:**
- `curl -X POST /api/triggers/:id` starts a run, returns run_id
- GitHub Actions action: build fails if any step fails, passes if all pass
- Slack notification sends on run_failed with step breakdown
- Throttle: max 1 notification per pipeline per hour (configurable)

---

## B12 — Settings & Admin
**Wave:** 4 | **Deps:** B03 | **Tasks:** 061–066 | **Est:** 4–5 days

Can run in parallel with B04. All settings UIs are CRUD over existing API entities.

**Tasks:**
- 061 — Runner management UI
- 062 — Secrets management UI
- 063 — Environment management UI
- 064 — Team management UI
- 065 — Integration settings UI
- 066 — Notification settings UI

**Exit criteria:**
- Secret value never appears in UI — only name, created date, usage count
- Runner token shown once on creation, never again
- Integration: OAuth flow completes, test connection button validates credentials

---

## B13 — Marketing Website
**Wave:** 1 (starts with B01, fully independent) | **Tasks:** 067–073 | **Est:** 6–8 days

Can start as soon as design tokens from B01 are extracted into a shared package.
Fully independent — separate Next.js app, separate deploy.

**Tasks:**
- 067 — Site scaffold (Next.js, CT design system, Emerald brand)
- 068 — Landing page
- 069 — Features page
- 070 — Pricing page
- 071 — Changelog + blog (MDX)
- 072 — Docs site
- 073 — App ↔ website integration

**Exit criteria:**
- testing.continuous.engineering deploys independently of the app
- Landing page Lighthouse score ≥ 95 (performance, accessibility)
- CTA → signup → onboarding → dashboard flow works end-to-end
- Docs: getting started guide runnable in < 10 minutes by a new user

---

## B14 — Self-Hosted Runner
**Wave:** 5 | **Deps:** B04 | **Tasks:** 074–075 | **Est:** 2–3 days

Same runner protocol as cloud runners. Customer deploys one Docker container.

**Tasks:**
- 074 — Self-hosted runner agent
- 075 — One-liner install + docs

**Exit criteria:**
- `docker run -e API_KEY=xxx ct/runner` registers, polls, executes a full pipeline
- Results post back to SaaS correctly, secrets never written to disk
- Docs: customer can self-host a runner in under 5 minutes

---

## Execution Summary

| Bundle | Wave | Deps    | Tasks    | Est       | Can parallel with |
|--------|------|---------|----------|-----------|-------------------|
| B01    | 1    | —       | 001–007  | 6–8d      | B13 (partial)     |
| B13    | 1→   | B01(02) | 067–073  | 6–8d      | B01, B02, B03     |
| B02    | 2    | B01     | 008–015  | 3–4d      | B13               |
| B03    | 3    | B02     | 016–021  | 4–5d      | B13               |
| B04    | 4    | B03     | 022–028  | 6–8d      | B12               |
| B12    | 4    | B03     | 061–066  | 4–5d      | B04               |
| B05    | 5    | B04     | 029–031  | 4–5d      | B06,B09,B10,B11,B14 |
| B06    | 5    | B04     | 032–037  | 6–8d      | B05,B09,B10,B11,B14 |
| B09    | 5    | B04     | 044–047  | 5–6d      | B05,B06,B10,B11,B14 |
| B10    | 5    | B04     | 048–054  | 6–7d      | B05,B06,B09,B11,B14 |
| B11    | 5    | B04     | 055–060  | 3–4d      | B05,B06,B09,B10,B14 |
| B14    | 5    | B04     | 074–075  | 2–3d      | B05,B06,B09,B10,B11 |
| B07    | 6    | B05+B06 | 038–039  | 4–5d      | B08               |
| B08    | 6    | B06     | 040–043  | 7–9d      | B07               |

**Total tasks:** 75
**Critical path:** B01 → B02 → B03 → B04 → B06 → B08 (042)
**Minimum calendar time (full parallelism):** ~8 weeks
