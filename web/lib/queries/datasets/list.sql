SELECT id, name, description, schema_json, row_count, created_at, updated_at
FROM datasets
WHERE project_id = $1
  AND tenant_id  = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
ORDER BY name ASC;
