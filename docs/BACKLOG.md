# continuous.testing — Product Backlog

> **Platform:** SaaS multi-tenant test management — API, UI, AI unified on a Step/DAG model
> **Stack:** Next.js App Router · TypeScript · Tailwind · shadcn/ui · PostgreSQL · BullMQ · Playwright · Claude API
> **Website:** testing.continuous.engineering | **App:** continuous.testing
>
> **Architecture decisions locked (see docs/adrs/):**
> - DAG = unit of execution = one runner. No per-step runner routing. `runs_on` on pipeline only.
> - Runner scope: `hosted` (platform, shared pool) or `self-hosted` (customer, tenant-scoped).
> - Runners registered per tenant by authenticated user. Tagged for routing. `FOR UPDATE SKIP LOCKED` dispatch.
> - Usage-based billing: `runner_minutes` tracked per run, rolled up to `usage_ledger` per tenant per month.
> - Hosted runner minutes billed. Self-hosted runner minutes tracked but not billed (customer's infra).
> - Scaffold started in `web/` — package.json, db/client.ts, db/query.ts, globals.css, migrations 001-004.

## Status Legend

| Symbol | Meaning |
|---|---|
| ⬜ | Pending |
| 🔄 | In progress |
| ✅ | Completed |
| ❌ | Blocked |
| ⏭ | Deferred |

---

## FOUNDATION

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 001 | ✅ | Next.js App Router scaffold — TypeScript strict, Tailwind, shadcn/ui, ESLint | B01 | M |
| 002 | ✅ | Design token system — CSS custom props, Emerald palette, dark/light/system theme switching | B01 | M |
| 003 | ✅ | Core UI components — DenseTable (36px rows), StatusBadge, AppShell, Sidebar, TopNav, ThemeToggle | B01 | L |
| 004 | ✅ | PostgreSQL pool + SQL query abstraction — `query/one/tx`, `.sql` file loader, no ORM | B01 | S |
| 005 | ✅ | node-pg-migrate setup + `migrate:up / migrate:down` npm scripts | B01 | XS |
| 006 | ✅ | Auth — Clerk multi-tenant, org/user model, middleware, tenant context injected per request | B01 | M |
| 007 | ✅ | Multi-tenant RLS — row-level security policies, `tenant_id` on every table | B01 | M |

---

## DATABASE SCHEMA

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 008 | ✅ | Migration 001 — tenants, projects, memberships, soft-delete pattern | B02 | S |
| 009 | ✅ | Migration 002 — pipelines + steps (DAG, `prerequisites[]`, `outputs[]`, `config JSONB` per type) | B02 | M |
| 010 | ✅ | Migration 003 — environments + secrets (`encrypted_value`, `key_version`) | B02 | S |
| 011 | ✅ | Migration 004 — runs, run_results, ctx_snapshots (one row per step per run) | B02 | M |
| 012 | ✅ | Migration 005 — issues, issue_refs, sync_log (10 core fields, external_refs JSONB) | B02 | M |
| 013 | ✅ | Migration 006 — runners, runner_jobs (tags TEXT[], scope hosted/self-hosted, heartbeat, `runner_minutes` NUMERIC, `usage_ledger` billing table) | B02 | M |
| 014 | ✅ | Migration 007 — datasets, dataset_rows (parameterized test data, schema_json) | B02 | S |
| 015 | ✅ | Migration 008 — openapi_specs, coverage_snapshots (spec JSON, coverage % per endpoint) | B02 | S |

---

## CORE DATA APIS

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 016 | ✅ | Projects API — CRUD, tenant-scoped, membership enforcement | B03 | S |
| 017 | ✅ | Pipelines API — CRUD, DAG cycle validation on save, `runs_on` tag requirement (pipeline-level only, no per-step override) | B03 | M |
| 018 | ✅ | Steps API — CRUD, type-specific config validation (api/ui/ai schemas), `prerequisites[]` + `outputs[]` binding declarations | B03 | M |
| 019 | ✅ | Environments API — CRUD, active environment per project | B03 | S |
| 020 | ✅ | Secrets vault API — create/list/delete, AES-256-GCM encrypt on write, value never returned | B03 | M |
| 021 | ✅ | Datasets API — CRUD, CSV multipart upload → rows, faker schema → generate rows | B03 | M |

---

## EXECUTION ENGINE

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 022 | ✅ | BullMQ queue setup — job types (run_dag, sync_issues, send_notification), retry, dead-letter | B04 | M |
| 023 | ✅ | Runner registration + auth — token issuance, `tags TEXT[]`, `scope: hosted/self-hosted`, heartbeat, revoke. Platform hosted runners pre-registered. Customer runners registered by authenticated tenant user. | B04 | M |
| 024 | ✅ | Job claim + context injection — tag-based dispatch (`required_tags <@ runner.tags`), `FOR UPDATE SKIP LOCKED`, decrypt secrets in memory only, serialize full DAG. `runner_minutes` written to `usage_ledger` on completion. | B04 | M |
| 025 | ✅ | DAG executor — Kahn's topological sort, Promise.all per wave, ctx merging, SKIPPED on prerequisite failure. One DAG = one runner = one process = one ctx map. No cross-runner context. | B04 | L |
| 026 | ✅ | API step driver — all HTTP methods, status/header/body assertions, operators, JSONPath, output binding | B04 | L |
| 027 | ✅ | AI step driver — Claude API proxied through backend, semantic score vs threshold | B04 | M |
| 028 | ✅ | SSE run streaming — EventSource per run, step result events, completion/error events | B04 | M |

---

## UI STEP DRIVER

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 029 | ✅ | Playwright UI step driver — headless Chromium in Docker, video + trace artifacts to S3 | B05 | L |
| 030 | ✅ | json-server mock — ephemeral per run, db.json seed, auth/latency/error-rate middleware toggles | B05 | M |
| 031 | ✅ | Runner Docker image — Playwright + json-server + runner agent, published to registry | B05 | M |

---

## PIPELINE AUTHORING UI

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 032 | ✅ | Pipeline canvas — linear view default, step cards, add/remove/reorder, advanced DAG toggle | B06 | L |
| 033 | ✅ | API step designer — method/URL/auth/body/headers, JSONPath assertion builder, response preview | B06 | L |
| 034 | ✅ | UI step designer — action list, selector display with health indicator (ARIA/testid/css priority) | B06 | L |
| 035 | ✅ | AI step designer — prompt editor, expected response, threshold slider, live score preview | B06 | M |
| 036 | ✅ | Context binding UI — design-time output declaration, downstream binding dropdowns (no freetext) | B06 | M |
| 037 | ✅ | Pipeline run controls — trigger, stop, live step status via SSE, step timeline view | B06 | M |

---

## BROWSER RECORDING

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 038 | ⬜ | Browser recording session — Playwright capture, Claude semantic intent extraction per action | B07 | L |
| 039 | ⬜ | Self-healing selector engine — ARIA → testid → text → AI match → visual → CSS, warn when CSS wins | B07 | L |

---

## IMPORT & INTELLIGENCE

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 040 | ⬜ | OpenAPI spec import — parse → API step stubs + Claude-generated realistic mock db.json | B08 | M |
| 041 | ⬜ | HAR file import — DevTools export → API step stubs from real captured traffic | B08 | M |
| 042 | ⬜ | Git repo + Claude journey map — clone, analyze routes/components, journey suggestions, test scaffolding | B08 | XL |
| 043 | ⬜ | Postman collection import — v2.1 JSON → pipeline, environment → CT environment | B08 | M |

---

## DASHBOARD & ANALYTICS

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 044 | ✅ | Main dashboard — run health 24h, needs-attention panel, recent runs table, runner status | B09 | L |
| 045 | ✅ | Flaky detection — SQL analytics, 30d sparkline per step, step badge, dashboard widget, CI gate | B09 | M |
| 046 | ✅ | OpenAPI coverage map — spec vs test suite heatmap, coverage %, click gap → draft step scaffold | B09 | M |
| 047 | ✅ | Snapshot/baseline testing — S3 artifact, diff engine, AI-described UI changes, approval flow, auto-issue | B09 | L |

---

## ISSUES HUB

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 048 | ✅ | Internal issues model CRUD + API — 10 core fields, status/severity enums, source run+step linkage | B10 | M |
| 049 | ✅ | Auto-issue creation on failure — dedup same step+pipeline, regression reopen when test re-fails | B10 | M |
| 050 | ✅ | Background sync worker — BullMQ repeat job 60s, sync_log table drives all push/pull | B10 | M |
| 051 | ✅ | Jira sync adapter — OAuth2, push/pull/handleWebhook, our 4 statuses → Jira transitions | B10 | L |
| 052 | ✅ | GitHub Issues sync adapter — PAT/OAuth, push/pull/handleWebhook, open/closed mapping | B10 | M |
| 053 | ✅ | Linear sync adapter — API key, push/pull/handleWebhook, priority + status mapping | B10 | M |
| 054 | ✅ | Issues list UI — dense table, status/severity filter, sync status indicator, external deep links | B10 | M |

---

## CI/CD & NOTIFICATIONS

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 055 | ✅ | Webhook trigger endpoint — POST /api/triggers/:pipelineId, returns run_id, async execution | B11 | M |
| 056 | ✅ | GitHub Actions official action — wraps webhook trigger + polling + exit code, marketplace publish | B11 | M |
| 057 | ✅ | Notification adapter system — event bus, per-pipeline config, throttle (no spam on flaky suite) | B11 | M |
| 058 | ✅ | Slack notification adapter — webhook URL, channel, rich block message with run summary | B11 | S |
| 059 | ✅ | Email notification adapter — Resend, HTML template, per-event recipient list | B11 | S |
| 060 | ✅ | Outbound webhook notification adapter — any URL, custom headers, JSON payload shape | B11 | S |

---

## SETTINGS & ADMIN

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 061 | ✅ | Runner management UI — list, register (token copy-on-create), tags, last-seen, revoke | B12 | M |
| 062 | ✅ | Secrets management UI — list, create, update, value never shown, referenced-by pipelines | B12 | M |
| 063 | ✅ | Environment management UI — profiles, variable editor, active env, diff between envs | B12 | M |
| 064 | ✅ | Team management UI — invite by email, Admin/Member/Viewer roles, remove | B12 | M |
| 065 | ✅ | Integration settings UI — Jira/GitHub/Linear OAuth config, test connection, connection health | B12 | M |
| 066 | ✅ | Notification settings UI — event × channel matrix, per-pipeline override, throttle config | B12 | M |

---

## MARKETING WEBSITE

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 067 | ✅ | testing.continuous.engineering scaffold — Next.js, CT design tokens, Emerald brand, separate app | B13 | M |
| 068 | ✅ | Landing page — hero, value props, animated pipeline demo, social proof, CTA | B13 | L |
| 069 | ✅ | Features page — step model, AI test generation, runner model, self-healing selectors | B13 | M |
| 070 | ✅ | Pricing page — 3 tiers (Starter/Team/Enterprise), comparison vs TestRail/Zephyr, FAQ | B13 | M |
| 071 | ✅ | Changelog + blog — MDX, continuous.engineering editorial style, launch announcement | B13 | S |
| 072 | ✅ | Docs site — getting started, runner setup guide, CI/CD integration, API reference | B13 | L |
| 073 | ✅ | App ↔ website integration — SSO entry from marketing, signup CTA → onboarding → dashboard | B13 | M |

---

## SELF-HOSTED RUNNER

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 074 | ✅ | Self-hosted runner agent — Docker image, registration flow, polling, stateless lifecycle | B14 | L |
| 075 | ✅ | Runner one-liner install + docs — docker run command, env vars, registration walkthrough | B14 | S |

---

## SELF-TEST LOOP (platform tests itself)

| #   | Status | Task                                                                 | Bundle | Size |
|-----|--------|----------------------------------------------------------------------|--------|------|
| 076 | 🔄 | Docker Compose with Caddy reverse proxy + ct-network — only Caddy exposed on :8080 | B15 | S |
| 077 | 🔄 | Test mode auth bypass — X-CT-Test-Key header + CT_TEST_API_KEY env var, fixed test tenant | B15 | S |
| 078 | 🔄 | Runner token seeding — 3 hosted runners pre-registered in DB via migration 000 | B15 | S |
| 079 | 🔄 | Bootstrap test script — Claude generates pipelines from codebase, triggers runs, polls results | B15 | M |
| 080 | 🔄 | Autonomous fix loop — iterate until all tests pass, write devlog on each run | B15 | L |
| 081 | ⬜ | Bug: runner heartbeat response — must return `runnerId` field | B15 | XS |
| 082 | ⬜ | Bug: middleware test-key bypass — runners/ must remain public (X-Runner-Token auth) | B15 | XS |
| 083 | ⬜ | Bug: RLS test tenant — SET LOCAL must use correct UUID for test tenant | B15 | S |
| 084 | ⬜ | Bug: runs/get-by-id needs tenant RLS context set before query | B15 | XS |
