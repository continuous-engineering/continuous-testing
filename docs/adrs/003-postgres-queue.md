# ADR 003 — Job Queue: PostgreSQL SKIP LOCKED, not Redis/BullMQ

**Date:** 2026-04-13
**Status:** Accepted

---

## Context

B04 originally used BullMQ + Redis for the job queue. The runner already uses `SELECT FOR UPDATE SKIP LOCKED` in `claim-job.sql` for its dispatch query. Redis adds a second stateful service with no unique benefit at our scale.

## Decision

Drop Redis and BullMQ. Use PostgreSQL `runner_jobs` table as the job queue.

Enqueue: `INSERT INTO runner_jobs ... status = 'pending'`
Claim: `UPDATE runner_jobs SET status = 'claimed' WHERE id = (SELECT ... FOR UPDATE SKIP LOCKED) RETURNING ...`

## Benefits

- Zero extra infra — Postgres is already required
- ACID: enqueue run job + create run record in one transaction (no dual-write)
- `FOR UPDATE SKIP LOCKED` handles concurrent runners correctly — proven pattern (Oban, Que, Solid Queue, pg-boss all use it)
- Simpler ops: one connection string, one backup, one monitoring surface

## Consequences

- BullMQ features not used: rate limiting per queue, repeatable jobs, job groups. None needed now.
- At very high throughput (10k+ jobs/min), a dedicated queue service would outperform Postgres. Not our concern at launch.
- `REDIS_URL` removed from `.env.example`
- `bullmq` and `ioredis` removed from `web/package.json` dependencies
