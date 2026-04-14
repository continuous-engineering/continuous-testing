SELECT id, name, version, spec_json, endpoint_count, created_at
FROM openapi_specs
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL;
