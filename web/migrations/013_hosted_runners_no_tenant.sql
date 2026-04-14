-- Migration 013: hosted runners have no tenant — they are platform infrastructure
--
-- Before: hosted runners were seeded with tenant_id = 00000000-0000-0000-0000-000000000001 (test tenant).
-- After:  hosted runners have tenant_id = NULL — visible to and usable by all tenants.
--
-- The runners table already has:
--   - tenant_id nullable (no NOT NULL constraint)
--   - RLS policy: USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid)
--
-- This migration just clears the test-tenant ID from existing hosted runners.

UPDATE runners
SET tenant_id = NULL
WHERE scope = 'hosted' AND tenant_id IS NOT NULL;

-- runner_jobs: update RLS so hosted runners (identified by app.is_hosted_runner session var)
-- can see jobs from all tenants. Self-hosted runners only see their own tenant's jobs.
DROP POLICY IF EXISTS tenant_isolation ON runner_jobs;
CREATE POLICY tenant_isolation ON runner_jobs
  USING (
    tenant_id = current_setting('app.tenant_id', true)::uuid
    OR current_setting('app.is_hosted_runner', true) = 'true'
  );
