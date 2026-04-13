SELECT id, tenant_id, name, scope, tags, capabilities, status
FROM runners
WHERE token_hash = $1
  AND revoked_at IS NULL;
