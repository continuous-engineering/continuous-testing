-- INTERNAL USE ONLY — only called by job context builder, never by API routes
SELECT id, name, encrypted_value, key_version
FROM secrets
WHERE project_id = $1
  AND tenant_id  = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
  AND name = ANY($2::text[]);
