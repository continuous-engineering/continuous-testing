INSERT INTO datasets (tenant_id, project_id, name, description, schema_json)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, $3, $4::jsonb
)
RETURNING id, name, description, schema_json, row_count, created_at, updated_at;
