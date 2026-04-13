SELECT id, name, is_default, variables, created_at, updated_at
FROM environments
WHERE project_id = $1
  AND tenant_id  = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
ORDER BY is_default DESC, name ASC;
