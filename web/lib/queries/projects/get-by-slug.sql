SELECT id FROM projects
WHERE slug = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL;
