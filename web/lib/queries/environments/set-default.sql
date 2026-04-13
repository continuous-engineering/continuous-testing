-- Unset all defaults for this project, then set the new one
UPDATE environments
SET is_default = (id = $1), updated_at = now()
WHERE project_id = $2
  AND tenant_id  = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL;
