-- Migration 011: retarget all tenant_id FKs from tenants → orgs
--
-- Problem: migration 010 created the orgs table for own-auth (B16) but left
-- all 19 business tables with FK constraints pointing at tenants(id).
-- Session middleware injects x-tenant-id = orgs.id, so every write fails with:
--   "Key (tenant_id)=(…) is not present in table tenants"
--
-- Fix:
--   1. Insert legacy tenants into orgs where not already present (preserves
--      the test tenant UUID 00000000-0000-0000-0000-000000000001 exactly, so
--      seeded runners/pipelines continue to work).
--   2. Drop all 19 FK constraints pointing at tenants(id).
--   3. Re-add them pointing at orgs(id).
--
-- The tenants table is kept for historical reference but is no longer the
-- FK target. New code must never insert into tenants — use orgs instead.

BEGIN;

-- 1. Pull legacy tenants into orgs where not already present.
--    Only insert if the UUID doesn't already exist in orgs (avoids PK conflict).
--    Slug conflicts (same name, different UUID) are skipped — those are stale
--    Clerk-era rows with no business data attached.
INSERT INTO orgs (id, name, slug, plan, created_at, updated_at)
SELECT t.id, t.name, t.slug || '_legacy', 'starter', t.created_at, t.created_at
FROM tenants t
WHERE t.id NOT IN (SELECT id FROM orgs)
  AND t.slug NOT IN (SELECT slug FROM orgs)   -- skip slug collisions
ON CONFLICT DO NOTHING;

-- Test tenant UUID must land in orgs exactly as-is (runners seeded with this ID)
INSERT INTO orgs (id, name, slug, plan)
VALUES ('00000000-0000-0000-0000-000000000001', 'CT Self-Test', 'ct-self-test', 'starter')
ON CONFLICT (id) DO NOTHING;

-- 2. Drop all FK constraints pointing at tenants(id)
ALTER TABLE api_keys           DROP CONSTRAINT api_keys_tenant_id_fkey;
ALTER TABLE coverage_snapshots DROP CONSTRAINT coverage_snapshots_tenant_id_fkey;
ALTER TABLE dataset_rows       DROP CONSTRAINT dataset_rows_tenant_id_fkey;
ALTER TABLE datasets           DROP CONSTRAINT datasets_tenant_id_fkey;
ALTER TABLE environments       DROP CONSTRAINT environments_tenant_id_fkey;
ALTER TABLE issue_refs         DROP CONSTRAINT issue_refs_tenant_id_fkey;
ALTER TABLE issues             DROP CONSTRAINT issues_tenant_id_fkey;
ALTER TABLE memberships        DROP CONSTRAINT memberships_tenant_id_fkey;
ALTER TABLE openapi_specs      DROP CONSTRAINT openapi_specs_tenant_id_fkey;
ALTER TABLE pipelines          DROP CONSTRAINT pipelines_tenant_id_fkey;
ALTER TABLE projects           DROP CONSTRAINT projects_tenant_id_fkey;
ALTER TABLE run_results        DROP CONSTRAINT run_results_tenant_id_fkey;
ALTER TABLE runner_jobs        DROP CONSTRAINT runner_jobs_tenant_id_fkey;
ALTER TABLE runners            DROP CONSTRAINT runners_tenant_id_fkey;
ALTER TABLE runs               DROP CONSTRAINT runs_tenant_id_fkey;
ALTER TABLE secrets            DROP CONSTRAINT secrets_tenant_id_fkey;
ALTER TABLE steps              DROP CONSTRAINT steps_tenant_id_fkey;
ALTER TABLE sync_log           DROP CONSTRAINT sync_log_tenant_id_fkey;
ALTER TABLE usage_ledger       DROP CONSTRAINT usage_ledger_tenant_id_fkey;

-- 3. Re-add FKs pointing at orgs(id) — same CASCADE behaviour
ALTER TABLE api_keys           ADD CONSTRAINT api_keys_tenant_id_fkey           FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE coverage_snapshots ADD CONSTRAINT coverage_snapshots_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE dataset_rows       ADD CONSTRAINT dataset_rows_tenant_id_fkey       FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE datasets           ADD CONSTRAINT datasets_tenant_id_fkey           FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE environments       ADD CONSTRAINT environments_tenant_id_fkey       FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE issue_refs         ADD CONSTRAINT issue_refs_tenant_id_fkey         FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE issues             ADD CONSTRAINT issues_tenant_id_fkey             FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE memberships        ADD CONSTRAINT memberships_tenant_id_fkey        FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE openapi_specs      ADD CONSTRAINT openapi_specs_tenant_id_fkey      FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE pipelines          ADD CONSTRAINT pipelines_tenant_id_fkey          FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE projects           ADD CONSTRAINT projects_tenant_id_fkey           FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE run_results        ADD CONSTRAINT run_results_tenant_id_fkey        FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE runner_jobs        ADD CONSTRAINT runner_jobs_tenant_id_fkey        FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE runners            ADD CONSTRAINT runners_tenant_id_fkey            FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE runs               ADD CONSTRAINT runs_tenant_id_fkey               FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE secrets            ADD CONSTRAINT secrets_tenant_id_fkey            FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE steps              ADD CONSTRAINT steps_tenant_id_fkey              FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE sync_log           ADD CONSTRAINT sync_log_tenant_id_fkey           FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;
ALTER TABLE usage_ledger       ADD CONSTRAINT usage_ledger_tenant_id_fkey       FOREIGN KEY (tenant_id) REFERENCES orgs(id) ON DELETE CASCADE;

COMMIT;
