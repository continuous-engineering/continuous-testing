# BUNDLE B02 — Database Schema
**Tasks:** #008–015
**Started:** 2026-04-13 | **Finished:** 2026-04-13
**Status:** complete | **Actual:** 0m (completed as part of B01) | **Model:** sonnet

## Plan
- [x] #008 — Migration 001: tenants, projects, memberships
- [x] #009 — Migration 002: pipelines + steps (DAG model)
- [x] #010 — Migration 003: environments + secrets
- [x] #011 — Migration 004: runs, run_results, usage_ledger
- [x] #012 — Migration 005: issues, issue_refs, sync_log
- [x] #013 — Migration 006: runners, runner_jobs, usage_ledger
- [x] #014 — Migration 007: datasets, dataset_rows
- [x] #015 — Migration 008: openapi_specs, coverage_snapshots

## Decisions
- All 8 migrations written during B01 — B02 is pre-complete
- RLS enabled on every table via `SET LOCAL app.tenant_id`
- `usage_ledger` append-only billing (ADR-002)
- `runner_jobs` dispatch uses `required_tags <@ runner.tags` + `FOR UPDATE SKIP LOCKED` (ADR-001)
- `secrets.encrypted_value` — AES-256-GCM, key_version tracked for rotation

## Files Changed
- web/migrations/001_tenants_projects.sql
- web/migrations/002_pipelines_steps.sql
- web/migrations/003_environments_secrets.sql
- web/migrations/004_runs_results.sql
- web/migrations/005_issues.sql
- web/migrations/006_runners.sql
- web/migrations/007_datasets.sql
- web/migrations/008_openapi_specs.sql

## Blockers — (none)
