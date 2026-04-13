# ADR 001 — Runner Model: DAG as Unit of Execution

**Date:** 2026-04-13
**Status:** Accepted

---

## Context

The platform executes test pipelines (DAGs of Steps). A question arose about whether runner assignment should happen at the step level or the pipeline/DAG level.

Steps share an in-memory context map (`ctx`) — upstream steps write outputs, downstream steps read them. If steps ran on different runners, `ctx` would need to be serialized and transferred mid-execution, creating a distributed state problem.

---

## Decision

**One DAG = one runner = one process = one `ctx` map.**

`runs_on` (runner tag requirement) is set at the **pipeline level only**. There is no per-step runner override.

```sql
pipelines.runs_on  TEXT[]  -- e.g. ["hosted"] or ["self-hosted", "internal"]
-- steps has NO runs_on column
```

The runner that claims a DAG job must have all capabilities needed to execute all step types in that pipeline. If a runner lacks a capability (e.g., no Playwright for a UI step), the job fails with `capability_missing` — this is a configuration error surfaced to the user, not a routing problem.

---

## Runner Scopes

**Hosted runners** — platform-managed Docker containers, shared pool across tenants, pre-registered by platform operator with tags `["hosted", ...]`. Isolated per job — no cross-tenant data.

**Self-hosted runners** — customer-managed Docker containers, registered by an authenticated tenant user, `tenant_id`-scoped. Can only claim jobs for their own tenant. Run inside the customer's network.

---

## Registration

Customer registers a runner via Settings → Runners. They assign tags (e.g., `["self-hosted", "internal", "staging"]`). Platform issues a runner token (JWT: tenant_id + runner_id). Token shown once, stored by customer, used by the runner process for all subsequent API calls.

---

## Dispatch

```sql
SELECT j.id, j.run_id, j.required_tags
FROM   runner_jobs j
WHERE  j.status = 'pending'
  AND  j.tenant_id = $1
  AND  j.required_tags <@ $2       -- required ⊆ runner tags
ORDER BY j.priority DESC, j.created_at ASC
LIMIT  1
FOR UPDATE SKIP LOCKED             -- concurrent runners safe, no double-claim
```

---

## Consequences

- Context passing between steps is simple in-memory map merge — no serialization overhead.
- Pipeline authors choose runner capability at the pipeline level, not per step.
- Customers wanting to test internal systems deploy a self-hosted runner with the appropriate tags.
- Runner infrastructure is simple: Docker image polls queue, claims job, executes DAG, reports results, wipes memory.
