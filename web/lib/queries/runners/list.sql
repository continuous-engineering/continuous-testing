-- Hosted runners (tenant_id IS NULL) are platform-wide and visible to all tenants.
-- Self-hosted runners are tenant-scoped.
SELECT id, name, scope, tags, capabilities, status, last_seen_at, registered_by, created_at
FROM runners
WHERE (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id', true)::uuid)
  AND revoked_at IS NULL
ORDER BY scope, name;
