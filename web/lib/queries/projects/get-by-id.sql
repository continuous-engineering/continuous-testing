SELECT id, name, slug, description, created_at, updated_at
FROM projects
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL;
