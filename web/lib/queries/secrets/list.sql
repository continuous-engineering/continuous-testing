-- encrypted_value intentionally excluded — never returned via API
SELECT id, name, key_version, last_used_at, use_count, created_by, created_at, updated_at
FROM secrets
WHERE project_id = $1
  AND tenant_id  = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
ORDER BY name ASC;
