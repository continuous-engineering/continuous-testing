# continuous.testing — Web App (SaaS)

Next.js 15 App Router — the main SaaS platform.

## Stack

- **Frontend:** Next.js 15 App Router, React 19, TypeScript strict
- **Styling:** Tailwind CSS 4, shadcn/ui (owned components in components/ui/)
- **State:** TanStack Query (server state) + Zustand (UI state)
- **Auth:** Clerk (multi-tenant, org model)
- **DB:** PostgreSQL — no ORM — raw SQL in lib/queries/*.sql
- **Migrations:** node-pg-migrate
- **Queue:** BullMQ + Redis
- **AI:** Anthropic Claude API (server-side proxy only)
- **Browser:** Playwright Core (headless Chromium in Docker)

## Build Commands

- **Check:** `npm run typecheck && npm run lint`
- **Build:** `npm run build`
- **Test:** none defined yet
- **Dev:** `npm run dev`
- **Migrate:** `npm run migrate:up`

## Key Conventions

- All SQL lives in `lib/queries/<entity>/<name>.sql` — never inline SQL in route handlers
- Use `query<T>()`, `one<T>()`, `tx()` from `lib/db/query.ts` — never import pg directly in routes
- Secrets: `encrypted_value` column NEVER appears in query results — always exclude explicitly
- Tenant context: every DB-touching route must call `getTenant()` and set `SET LOCAL app.tenant_id`
- `runs_on` lives on pipelines only — no per-step runner routing (ADR-001)
- Runner minutes written to `usage_ledger` on every run completion (ADR-002)

## Project Layout

```
app/
  (auth)/login/        ← Clerk sign-in page
  (shell)/             ← authenticated app shell (sidebar + topnav)
    layout.tsx
    page.tsx           ← dashboard
    projects/[projectId]/
    issues/
    flaky/
    settings/
  api/                 ← API route handlers
    triggers/          ← CI/CD webhook triggers (API key auth)
    webhooks/[adapter] ← Inbound sync webhooks
  layout.tsx           ← root (ClerkProvider, fonts, globals.css)

components/
  ui/          ← shadcn primitives (owned)
  layout/      ← AppShell, Sidebar, TopNav, ThemeToggle
  data/        ← DenseTable, charts
  domain/      ← StepStatusBadge, RunSummaryBar, etc.

lib/
  db/          ← client.ts (Pool), query.ts (query/one/tx/raw)
  queries/     ← .sql files by entity
  auth.ts      ← getTenant(), tenantSQLVar()
  utils.ts     ← cn()
  adapters/    ← Jira, GitHub, Linear sync adapters
  queue/       ← BullMQ workers and job definitions
  execution/   ← DAG executor, step drivers

migrations/   ← node-pg-migrate SQL files (001–008)
styles/       ← globals.css (design tokens)
```

## ADRs

- ADR-001: Runner model — DAG = unit of work, `runs_on` on pipeline only
- ADR-002: Usage billing — `runner_minutes` + `usage_ledger`, hosted billed, self-hosted tracked
