# continuous.testing — Web App (SaaS)

Next.js 15 App Router — the main SaaS platform at testing.continuous.engineering.

---

## Design Mantra — Invisible UI

> **The best UI is one users never think about. They act on pattern, not thought.**

- Position, color, shape, and motion carry meaning. Never change them arbitrarily.
- A blue button means action. An amber badge means warning. An emerald dot means passing. **Always.**
- If text says "BLUE" but is rendered in orange — users read it as ORANGE. The rendering wins, not the words.
- Consistency is trust. Every deviation costs cognitive load. Every violation breaks trust.
- Users learn your patterns once. After that, they move on autopilot. **Protect that state.**
- Same component, same color, same position = same meaning. Everywhere. No exceptions.

**In practice:**
- `StepStatusBadge` is the single source of truth for pass/fail/flaky/running/skipped. Never render status any other way.
- `--ct-pass` is always emerald. `--ct-fail` is always rose. `--ct-flaky` is always amber. These are semantic constants, not aesthetic choices.
- DenseTable rows are always 36px. Always. Not 34px somewhere and 40px somewhere else.
- Sidebar nav items follow the same active/hover states everywhere. No one-offs.

---

## Stack

- **Frontend:** Next.js 15 App Router, React 19, TypeScript strict
- **Styling:** Tailwind CSS 4, shadcn/ui (owned components in `components/ui/`)
- **State:** TanStack Query (server state) + Zustand (UI state)
- **Auth:** Clerk (multi-tenant, org model — `clerkMiddleware` in `middleware.ts`)
- **DB:** PostgreSQL — no ORM — raw SQL in `lib/queries/*.sql`
- **Migrations:** node-pg-migrate (`npm run migrate:up`)
- **Queue:** BullMQ + Redis
- **AI:** Anthropic Claude API (server-side proxy only — never exposed to client)
- **Browser:** Playwright Core (headless Chromium in Docker runner)

## Build Commands

- **Check:** `npm run typecheck && npm run lint`
- **Build:** `npm run build`
- **Dev:** `npm run dev`
- **Migrate:** `npm run migrate:up` / `npm run migrate:down`
- **Test:** none yet (added in B09)

## Current State (B01 complete)

**Built:**
- `app/layout.tsx` — root layout, ClerkProvider, Inter + JetBrains Mono fonts
- `app/(auth)/login/page.tsx` — Clerk SignIn component
- `app/(shell)/layout.tsx` — authenticated shell (Sidebar + TopNav)
- `app/(shell)/page.tsx` — dashboard stub (content in B09)
- `middleware.ts` — Clerk auth, tenant ID injected to headers, public routes
- `lib/auth.ts` — `getTenant()`, `tenantSQLVar()`, `getTenantIdFromHeaders()`
- `lib/db/client.ts` — pg Pool singleton
- `lib/db/query.ts` — `query<T>()`, `one<T>()`, `tx()`, `raw()`
- `lib/utils.ts` — `cn()` (clsx + tailwind-merge)
- `components/layout/Sidebar.tsx` — nav, active state, badge counts
- `components/layout/TopNav.tsx` — OrganizationSwitcher, ThemeToggle, UserButton
- `components/layout/ThemeToggle.tsx` — dark/light/system cycle, localStorage
- `components/data/DenseTable.tsx` — 36px rows, typed columns, empty state
- `components/domain/StepStatusBadge.tsx` — canonical status display component
- `styles/globals.css` — full design token set (colors, typography, density)
- `tailwind.config.ts` — extended theme (CT tokens, font scale, radius)
- `migrations/001–008` — full schema (tenants → openapi_specs)
- `.env.example` — documented env vars

**Not yet built (future bundles):**
- B02: DB schema is defined in migrations — needs a Postgres instance to run
- B03: API routes (projects, pipelines, steps, environments, secrets, datasets)
- B04: Execution engine (BullMQ, runner protocol, DAG executor, step drivers)
- B06: Pipeline canvas and step designer UIs

## Key Conventions

- All SQL in `lib/queries/<entity>/<name>.sql` — never inline SQL in route handlers
- Use `query<T>()`, `one<T>()`, `tx()` from `lib/db/query.ts` — never import `pg` directly in routes
- `encrypted_value` column NEVER in query results — exclude explicitly in every secrets query
- Every DB-touching route: call `getTenant()` then `SET LOCAL app.tenant_id = '...'` via `tenantSQLVar()`
- `runs_on` on pipelines only — no per-step runner routing (ADR-001)
- `runner_minutes` written to `usage_ledger` on run completion — hosted billed, self-hosted tracked (ADR-002)
- All shell pages: `export const dynamic = 'force-dynamic'` (Clerk auth requires runtime context)
- `.env.local` is gitignored — copy from `.env.example`, fill in real Clerk + DB + Redis keys

## Project Layout

```
app/
  (auth)/login/        ← Clerk sign-in
  (shell)/             ← authenticated app shell
    layout.tsx         ← Sidebar + TopNav
    page.tsx           ← Dashboard (stub — content in B09)
    projects/[projectId]/pipelines/[pipelineId]/
    issues/
    flaky/
    settings/runners|secrets|environments|integrations|team
  api/
    triggers/[pipelineId]/  ← CI/CD webhook (API key auth, not Clerk)
    webhooks/[adapter]/     ← inbound issue sync
  layout.tsx           ← ClerkProvider, fonts, globals.css

components/
  ui/          ← shadcn primitives (copy-owned, not a dependency)
  layout/      ← Sidebar, TopNav, ThemeToggle
  data/        ← DenseTable
  domain/      ← StepStatusBadge, RunSummaryBar (B09), FlakySpark (B09)

lib/
  db/          ← client.ts, query.ts
  queries/     ← .sql files by entity (pipelines/, steps/, runs/, etc.)
  auth.ts      ← getTenant(), tenantSQLVar()
  utils.ts     ← cn()
  adapters/    ← Jira, GitHub, Linear (B10)
  queue/       ← BullMQ workers (B04)
  execution/   ← DAG executor, step drivers (B04)
  store/       ← Zustand UI store (B06)

migrations/    ← 001–008, node-pg-migrate format
styles/        ← globals.css (design tokens)
```

## ADRs

- **ADR-001** (`docs/adrs/001-runner-model.md`): DAG = unit of work. `runs_on` on pipeline only. No per-step runner routing.
- **ADR-002** (`docs/adrs/002-usage-billing.md`): `runner_minutes` + `usage_ledger`. Hosted billed, self-hosted tracked.
