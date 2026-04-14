# App Review — continuous.testing
**Date:** 2026-04-14  
**Reviewer:** Architecture review (role-based walk-through)  
**App URL:** http://localhost:8080  
**Stack:** Next.js 14, PostgreSQL, Caddy, 3 runner containers

---

## Part 1 — Unimplemented & Stub Features

### Backlog vs Reality Discrepancies

The following tasks are marked ✅ in `BACKLOG.md` but the UI is not actually implemented:

| Task | Backlog Claim | Actual State | Severity |
|------|---------------|--------------|----------|
| #064 | Team management UI — invite by email, roles, remove | Stub page: "Coming in next release" | **Major** |
| #065 | Integration settings UI — Jira/GitHub/Linear OAuth config | Stub page: "Coming in next release" | **Major** |
| #085–090 | B16 Own Auth — 🔄 In Progress | Auth IS working (JWT, login/signup functional), backlog status stale | Minor — update backlog |

### Code-Level TODOs (functional gaps)

| File | Line | Issue | Severity |
|------|------|-------|----------|
| `app/(shell)/settings/secrets/page.tsx` | 18 | `projectId = ''` — TODO: derive from active project. Secrets page non-functional (all API calls hit `/api/projects//secrets`) | **Blocker** |
| `app/(shell)/settings/environments/page.tsx` | 15 | `projectId = ''` — TODO: from active project store. Environments page non-functional | **Blocker** |
| `app/(shell)/issues/page.tsx` | 39 | `projectId = ''` — TODO: from active project. Issues page non-functional | **Blocker** |
| `app/(shell)/projects/[projectId]/page.tsx` | 70 | `onClick={() => {/* create pipeline modal — B06 task 032 extension */}}` — button renders, does nothing | **Major** |
| `lib/queue/index.ts` | 35–37 | `enqueueSyncIssues()` body is empty (comment only: "Implemented in B10") | **Major** |
| `lib/queue/index.ts` | 39–43 | `enqueueNotification()` body is empty (comment only: "Implemented in B11") | **Major** |

### Known Bugs (Backlog ⬜)

| Task | Bug | Status |
|------|-----|--------|
| #081 | Runner heartbeat response must return `runnerId` field | ⬜ Pending |
| #082 | Middleware test-key bypass — `/api/runners/*` must stay public | ⬜ Pending |
| #083 | RLS test tenant — SET LOCAL must use correct UUID | ⬜ Pending |
| #084 | `runs/get-by-id` needs tenant RLS context set before query | ⬜ Pending |

### Unimplemented Features (Backlog ⬜)

| Task | Feature | Bundle |
|------|---------|--------|
| #038 | Browser recording session (Playwright capture + Claude intent extraction) | B07 |
| #039 | Self-healing selector engine | B07 |
| #040 | OpenAPI spec import → API step stubs | B08 |
| #041 | HAR file import → API step stubs | B08 |
| #042 | Git repo + Claude journey map → test scaffolding | B08 |
| #043 | Postman collection import | B08 |

### UI-Level Issues (Not in backlog)

| Location | Issue | Severity |
|----------|-------|----------|
| Pipeline canvas (`/projects/[p]/pipelines/[p]`) | DAG toggle button exists but no DAG view component — clicking does nothing visible | Major |
| Pipeline canvas | SSE `EventSource` not cleaned up on component unmount — memory leak | Major |
| Pipeline canvas `StepEditorDrawer` | No JSON validation before saving step config — silently posts invalid JSON | Major |
| Pipeline canvas | Step deletion UI missing — steps can be added but not removed | Major |
| Pipeline canvas | Step reordering UI missing — `prerequisites[]` field in data model, no UI | Major |
| `/pipelines` page | N+1 query: fetches all projects then all pipelines per project in waterfall | Moderate |
| `/runs` page | Reuses `/api/dashboard` endpoint for runs list — inefficient; doesn't support pagination | Moderate |
| `TopNav.tsx` | Org switcher changes local state only — never persists to backend, resets on refresh | Major |
| `settings/runners` | Docker registration command shown is a hardcoded placeholder, not env-specific | Moderate |
| `settings/runners` | Runner token is generated but no clipboard copy button — manual copy required | Minor |
| `settings/runners` | No confirmation dialog before revoking a runner | Minor |
| `settings/secrets` | No confirmation dialog before deleting a secret | Minor |
| Dashboard | Health summary counts exclude `pending` and `cancelled` states from totals | Minor |
| Dashboard | No auto-refresh or manual refresh button — stale data on long sessions | Minor |

---

## Part 2 — User Roles & Journeys

### Roles Identified

1. **New User** — First time signing up, setting up a workspace
2. **QA Engineer** — Day-to-day test authoring, running pipelines, analyzing results
3. **DevOps / Platform Engineer** — Runner management, secrets, environments, CI/CD integration
4. **Engineering Manager** — Health dashboards, flaky test triage, issue assignment
5. **Developer (On-Call / Debugging)** — Investigating a test failure, reading a specific run

---

## Part 3 — Role Walk-Throughs & Issues Found

---

### Role 1: New User — First-Time Onboarding

**Journey:**
1. Land on http://localhost:8080 → redirected to `/login`
2. Click "Sign up" link → `/signup`
3. Fill in: full name, email, password, org name (optional)
4. Submit → redirected to `/` (dashboard)
5. Explore sidebar — see Pipelines, try to create first pipeline
6. Navigate to `/pipelines` → click "+ New Pipeline"
7. Get directed to pipeline canvas
8. Try to configure a step
9. Try to run it

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| N-01 | `/signup` | Org name field is optional but if skipped, the tenant name defaults to the user's name — not obvious, no placeholder text explaining this | Minor |
| N-02 | `/` Dashboard after signup | Dashboard shows all zeros — no empty state guidance ("Create your first pipeline to get started"), just blank counters | Major |
| N-03 | Sidebar | No onboarding flow or getting-started checklist — new user sees 12 nav items with no orientation | Major |
| N-04 | `/pipelines` | First time: empty pipelines list with "No pipelines yet" message, but "+ New Pipeline" creates a project named with a timestamp slug (e.g., `project-1744632000000`) — not user-friendly | Major |
| N-05 | `/pipelines` → Quick Create | Quick-creating a pipeline creates a project with `Date.now()` as slug — no prompt for project name | Major |
| N-06 | Pipeline canvas | After creating pipeline, the step editor JSON config is a raw JSON textarea with no documentation — new user has no idea what schema to use | Major |
| N-07 | Pipeline canvas | "Run" button triggers execution but there's no pre-flight check — runner availability not surfaced before triggering | Moderate |
| N-08 | `/settings/secrets` | Navigating to Secrets shows an empty list (projectId is empty string) — no error shown, just permanently empty | **Blocker** |
| N-09 | `/settings/environments` | Same issue as Secrets — permanently empty, no error | **Blocker** |

**Verdict:** The new user flow has no onboarding guidance. A user who signs up has no clear path to creating their first meaningful test. Critical pages (secrets, environments) are broken with empty projectId.

---

### Role 2: QA Engineer — Test Authoring & Execution

**Journey A — Create and run a new API test pipeline:**
1. Go to `/pipelines`
2. Click existing project → open project page
3. Try to add a pipeline from project page (broken button)
4. Navigate to `/pipelines` instead, use global "+ New Pipeline"
5. Open pipeline canvas
6. Click "+ Add Step" → choose "API"
7. Configure: method, URL, assertions
8. Save step
9. Click "Run"
10. Watch live SSE updates

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| Q-01 | `/projects/[projectId]` | "+ New Pipeline" button is completely non-functional — silently does nothing | **Blocker** |
| Q-02 | Pipeline canvas | No step-type-specific forms — all step types use a raw JSON textarea as config editor. QA engineer must know the exact JSON schema for API/UI/AI steps — no guided form | Major |
| Q-03 | Pipeline canvas | No step deletion — once a step is added, it cannot be removed from the UI | Major |
| Q-04 | Pipeline canvas | No step reordering — can't rearrange step execution order via UI | Major |
| Q-05 | Pipeline canvas | `prerequisites[]` field exists in data model (for DAG wiring) but has no UI — can't set dependencies between steps | Major |
| Q-06 | Pipeline canvas | DAG view toggle button exists in header but has no implementation — clicking it silently does nothing | Major |
| Q-07 | Pipeline canvas | Step editor JSON config has no schema validation — save attempt with malformed JSON doesn't show a clear error | Moderate |
| Q-08 | Pipeline canvas | After a run completes, the step status UI doesn't persist — refreshing the page loses the last run status from the UI (though data is in DB) | Moderate |
| Q-09 | Step card | No indication of which step type is which (API/UI/AI) in the step card itself — must open editor to see | Minor |
| Q-10 | `/runs` | Runs page uses dashboard endpoint — no pagination, limited to last N runs, no filter by pipeline or status | Major |

**Journey B — Analyze test failures and flaky steps:**
1. Go to `/flaky` → view flaky steps table
2. Click a flaky step row (no action happens — no drilldown)
3. Go to dashboard → click a recent run
4. View run detail

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| Q-11 | `/flaky` | Rows are not clickable — no drilldown to see individual run history for a flaky step | Major |
| Q-12 | `/flaky` | No "suppress" or "snooze" action — can't acknowledge a known flaky step | Major |
| Q-13 | Dashboard → run row | Clicking a recent run navigates to pipeline detail, not the specific run detail — user has to find the run again | Moderate |
| Q-14 | `/coverage` | Coverage "gap" endpoint rows show "Gap" status but clicking them doesn't scaffold a step — feature not wired up (backlog item #046 claims this as complete) | Major |

**Verdict:** QA Engineer is the primary user and the pipeline authoring UX has significant gaps. The raw JSON config editor is a substantial barrier. No step management (delete/reorder/prerequisite wiring) makes the tool hard to use beyond trivial linear pipelines.

---

### Role 3: DevOps / Platform Engineer — Infrastructure & Integration

**Journey A — Register a self-hosted runner:**
1. Navigate to `/settings/runners`
2. Click "Register Runner"
3. Fill form: name, tags
4. Submit → see registration token (shown once)
5. Copy Docker command to run runner

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| D-01 | `/settings/runners` | Token display has no "Copy to clipboard" button — must manually select and copy | Minor |
| D-02 | `/settings/runners` | Docker run command shown is a hardcoded placeholder string, not pre-filled with the actual token or the environment's API URL | Major |
| D-03 | `/settings/runners` | Runner "Capabilities" field is hardcoded to `api` only — no UI checkboxes for `ui`, `ai`, or custom capabilities | Major |
| D-04 | `/settings/runners` | No confirmation dialog before revoking a runner — destructive action is one click | Moderate |
| D-05 | `/settings/runners` | Hosted runners list shows status but no last-heartbeat timestamp in the table — only self-hosted shows it | Minor |

**Journey B — Manage secrets for a project:**
1. Navigate to `/settings/secrets`
2. Expect to see project-scoped secrets
3. See an empty list — no error, no explanation

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| D-06 | `/settings/secrets` | Page is broken — projectId is hardcoded as `''`. API call is `GET /api/projects//secrets` which returns empty or 404 | **Blocker** |
| D-07 | `/settings/secrets` | No project selector shown — user can't pick which project to view secrets for | Major |
| D-08 | `/settings/secrets` | No error or explanation for the empty state — user thinks they have no secrets, not that there's a bug | Major |

**Journey C — Configure environments:**
1. Navigate to `/settings/environments`
2. Same empty-projectId problem as secrets

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| D-09 | `/settings/environments` | Same root cause as secrets — projectId `''` makes page non-functional | **Blocker** |
| D-10 | `/settings/environments` | No environment deletion UI — environments can be created but not deleted | Moderate |

**Journey D — Set up Jira/GitHub/Linear integration:**
1. Navigate to `/settings/integrations`
2. See "Coming in next release" placeholder

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| D-11 | `/settings/integrations` | Entire feature is a stub — backlog task #065 marked ✅ but not implemented | **Major** — backlog mismatch |
| D-12 | `/settings/integrations` | Sync workers (`enqueueSyncIssues`) and notification adapters (`enqueueNotification`) have empty function bodies in `lib/queue/index.ts` — even if UI existed, they wouldn't work | **Major** |

**Verdict:** DevOps role is significantly impacted. Three critical pages (secrets, environments, integrations) are non-functional. The runner registration flow works but produces a placeholder Docker command. The platform is not deployable to a real team without fixing these.

---

### Role 4: Engineering Manager — Health & Issue Triage

**Journey A — Morning dashboard review:**
1. Open `/` → view pass rate, recent runs, flaky count, runner status
2. Click a flaky item → go to `/flaky` detail
3. Review `/issues` for open failures
4. Check `/coverage` for gaps

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| M-01 | Dashboard | Health summary doesn't include `pending` or `cancelled` in counts — manager sees incomplete picture | Minor |
| M-02 | Dashboard | No auto-refresh — data goes stale on a long session; no manual refresh button either | Moderate |
| M-03 | Dashboard | "Runner Status" panel shows count by scope but no health signal per runner (last heartbeat, jobs run) | Minor |
| M-04 | `/issues` | Issues page is non-functional — projectId `''` means no issues load. Manager can't triage test failures | **Blocker** |
| M-05 | `/issues` | Even if issues loaded: no assignee UI (field exists in DB, not rendered) | Moderate |
| M-06 | `/issues` | No severity filter in the filter bar (only status filter) — manager can't see "critical" issues only | Moderate |
| M-07 | `/coverage` | Coverage gap rows are not clickable/actionable — "click gap → draft step scaffold" (task #046) not wired up | Major |
| M-08 | `/flaky` | No trend data (backlog mentions "30d sparkline") — only current failure rate shown | Moderate |

**Journey B — Invite team member:**
1. Navigate to `/settings/team`
2. See "Coming in next release" placeholder

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| M-09 | `/settings/team` | Feature is a complete stub — task #064 marked ✅ in backlog but UI is placeholder | **Major** — backlog mismatch |
| M-10 | `TopNav` org switcher | Switching orgs updates UI state but doesn't persist — after page refresh, reverts to original org | Major |

**Verdict:** Manager's primary value (issue triage, team oversight, coverage health) is almost entirely blocked. Issues, team management, and org switching are all broken. Dashboard works but lacks refresh and is incomplete.

---

### Role 5: Developer (On-Call) — Investigating a Failure

**Journey — Investigate why CI failed:**
1. Get Slack notification with run link (if notifications worked)
2. Open app → find the failing run
3. View step-level detail
4. Look at step logs / AI response
5. Navigate to the pipeline to understand context
6. Check if it's a flaky test or regression
7. Create or update an issue

**Issues Found:**

| # | Where | Issue | Severity |
|---|-------|-------|----------|
| V-01 | Notifications | `enqueueNotification()` is an empty stub — Slack/Email/Webhook notifications never fire | **Blocker** |
| V-02 | `/runs` | No direct link from run table to run detail page — clicking goes to pipeline, not the specific run | Major |
| V-03 | Run detail (pipeline canvas) | SSE stream shows live updates but after completion, step cards show only status — no log output, no AI response text visible | Major |
| V-04 | Run detail | No artifact links — Playwright video/trace artifacts (backlog #029 claims S3) are not surfaced in UI | Major |
| V-05 | Issues | `/issues` page non-functional (projectId bug) — dev can't create or view issues | **Blocker** |
| V-06 | Run detail | No link from a step card to the issue it created — have to navigate manually | Moderate |
| V-07 | `/flaky` | No filter by project — shows all flaky steps across all projects | Minor |

**Verdict:** The investigative developer journey is almost entirely blocked. Notifications don't fire, run detail shows no logs, issues page is broken. The pipeline canvas shows step pass/fail after a run but provides no actionable detail (logs, AI output, artifacts).

---

## Part 4 — Summary Scorecard by Role

| Role | Journeys Tested | Blockers | Majors | Assessment |
|------|----------------|----------|--------|------------|
| New User | 1 | 2 | 4 | Cannot complete onboarding effectively |
| QA Engineer | 2 | 1 | 7 | Core authoring workflow has critical gaps |
| DevOps Engineer | 4 | 3 | 5 | 3 of 4 journeys completely blocked |
| Engineering Manager | 2 | 2 | 5 | Issue triage and team oversight both broken |
| Developer (On-Call) | 1 | 2 | 4 | Cannot investigate failures end-to-end |

---

## Part 5 — Priority Fix List

### P0 — Blockers (nothing else matters until these work)

1. **Fix `projectId` in secrets, environments, and issues pages** — derive from URL params or a global project store. These are the three pages most relevant to real usage and all are broken with the same root cause.
2. **Wire `enqueueSyncIssues` and `enqueueNotification`** — currently empty stubs; issues sync and notifications are completely inoperative.

### P1 — Major gaps in core flow

3. **Fix "+ New Pipeline" button** on `/projects/[projectId]/page.tsx` — open modal or navigate to create form.
4. **Step management UI** — add delete step, reorder steps (drag or up/down arrows), prerequisite selector (replaces freetext DAG wiring).
5. **Step config editors** — replace raw JSON textarea with type-specific guided forms for API/UI/AI steps (the JSON is the biggest UX barrier for QA engineers).
6. **DAG toggle** — either implement it or remove the button.
7. **SSE cleanup on unmount** — add `useEffect` cleanup to close `EventSource` when pipeline canvas unmounts.
8. **Org switcher persistence** — switching org must POST to `/api/auth/me` or re-issue a session cookie scoped to the new org.

### P2 — Significant UX gaps

9. **Run detail logs** — surface step logs, AI response text, and Playwright artifacts in step cards after run.
10. **Flaky step drilldown** — clicking a row should show run history for that specific step.
11. **Runner Docker command** — generate pre-filled command with actual token and `CT_API_BASE` URL.
12. **Runner capabilities checkboxes** — expose `api`, `ui`, `ai` capability tags in registration form.
13. **Coverage gap → scaffold** — wire the "Gap" endpoint click to step scaffolding (backlog #046 claims ✅).
14. **Empty state on dashboard** — show getting-started call-to-action when no data exists.
15. **Runs page** — add dedicated `/api/runs` endpoint with pagination and filters; stop reusing dashboard endpoint.

### P3 — Backlog corrections

16. **Mark #064 (Team UI) as ⬜** — it's a stub, not ✅.
17. **Mark #065 (Integrations UI) as ⬜** — it's a stub, not ✅.
18. **Mark #085–090 (B16 auth) as ✅** — auth is working, backlog shows 🔄.

---

*Review complete. Issues logged to `docs/app-review-2026-04-14.md`.*
