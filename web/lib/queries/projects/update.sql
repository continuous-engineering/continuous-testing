UPDATE projects
SET name        = COALESCE($2, name),
    description = COALESCE($3, description),
    updated_at  = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id, name, slug, description, created_at, updated_at;
