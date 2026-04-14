SELECT id, name, version, endpoint_count, created_at, updated_at
FROM openapi_specs
WHERE project_id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
ORDER BY created_at DESC;
