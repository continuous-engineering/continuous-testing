INSERT INTO secrets (tenant_id, project_id, name, encrypted_value, key_version, created_by)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, $3, $4, $5
)
RETURNING id, name, key_version, created_by, created_at, updated_at;
-- encrypted_value NOT returned
