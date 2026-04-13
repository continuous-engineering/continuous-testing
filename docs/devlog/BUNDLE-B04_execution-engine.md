# BUNDLE B04 — Execution Engine Core
**Tasks:** #022, #023, #024, #025, #026, #027, #028
**Started:** 2026-04-13 | **Started-At:** 2026-04-13T21:30:00
**Status:** in_progress | **Est:** 210min | **Model:** sonnet

## Plan
- [ ] #022 — BullMQ queue setup (M=30m)
- [ ] #023 — Runner registration + auth (M=30m)
- [ ] #024 — Job claim + context injection (M=30m)
- [ ] #025 — DAG executor (L=60m)
- [ ] #026 — API step driver (L=60m)
- [ ] #027 — AI step driver (M=30m)
- [ ] #028 — SSE run streaming (M=30m)

## Execution Log

## Files Changed

## Blockers — (none)

## Decisions
- ADR-001: One DAG = one runner = one process = one ctx. No per-step routing.
- ADR-002: runner_minutes written to usage_ledger on completion.
- Runner token: SHA-256 hash stored, plaintext issued once and discarded.
