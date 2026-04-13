UPDATE runners
SET revoked_at = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND revoked_at IS NULL
RETURNING id;
