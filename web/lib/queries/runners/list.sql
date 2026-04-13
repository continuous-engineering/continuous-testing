SELECT id, name, scope, tags, capabilities, status, last_seen_at, registered_by, created_at
FROM runners
WHERE (tenant_id = current_setting('app.tenant_id')::uuid OR scope = 'hosted')
  AND revoked_at IS NULL
ORDER BY scope, name;
