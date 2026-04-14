SELECT id, name, slug, description, owner, labels, homepage_url, report_recipients, metadata, created_at, updated_at
FROM projects
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL;
