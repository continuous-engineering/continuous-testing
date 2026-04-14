UPDATE datasets
SET name        = COALESCE($2, name),
    description = COALESCE($3, description),
    schema_json = COALESCE($4::jsonb, schema_json),
    updated_at  = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id, name, description, schema_json, row_count, updated_at;
