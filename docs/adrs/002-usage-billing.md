# ADR 002 — Usage-Based Billing: Runner Minutes Per Tenant

**Date:** 2026-04-13
**Status:** Accepted

---

## Context

The platform operates a shared pool of hosted runners (platform cost) and allows customer self-hosted runners (customer cost). Pricing must reflect actual resource consumption.

---

## Decision

**Track runner minutes on every run. Bill hosted minutes. Track but do not bill self-hosted minutes.**

### Tracking

`runs.runner_minutes` — computed on run completion:
```
runner_minutes = (completed_at - started_at) in minutes
```

`usage_ledger` — append-only billing record per run:
```sql
tenant_id, run_id, runner_id, runner_scope,
minutes, recorded_at, billing_period  -- 'YYYY-MM'
```

### Billing Rules

| Runner scope | Billed? | Notes |
|---|---|---|
| `hosted` | Yes | Platform absorbs compute, charges tenant |
| `self-hosted` | No | Customer's infra, tracked for analytics only |

Monthly invoice = `SUM(minutes) WHERE runner_scope = 'hosted' AND billing_period = 'YYYY-MM'` per tenant.

### Plan Limits

| Plan | Hosted minutes/month | Overage |
|---|---|---|
| Starter | 500 | Blocked (upgrade prompt) |
| Team | 5,000 | $0.01/minute |
| Enterprise | Unlimited | Negotiated |

---

## Consequences

- `usage_ledger` is append-only — no updates, only inserts. Safe for billing audit.
- Self-hosted runner usage visible to tenant in analytics dashboard (cost transparency, not billed).
- Monthly rollup query is a simple `GROUP BY tenant_id, billing_period`.
- Stripe integration (Phase 2) reads `usage_ledger` to create metered billing line items.
