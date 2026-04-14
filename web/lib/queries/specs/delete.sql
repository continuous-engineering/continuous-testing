UPDATE openapi_specs
SET deleted_at = now(), updated_at = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id;
