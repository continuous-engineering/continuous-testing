UPDATE secrets
SET encrypted_value = $2,
    key_version     = $3,
    updated_at      = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id, name, key_version, updated_at;
-- encrypted_value NOT returned
