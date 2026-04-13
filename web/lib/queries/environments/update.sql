UPDATE environments
SET name       = COALESCE($2, name),
    is_default = COALESCE($3, is_default),
    variables  = COALESCE($4::jsonb, variables),
    updated_at = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id, name, is_default, variables, created_at, updated_at;
