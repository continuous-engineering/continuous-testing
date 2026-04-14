UPDATE projects
SET name               = COALESCE($2, name),
    description        = COALESCE($3, description),
    owner              = COALESCE($4, owner),
    labels             = COALESCE($5, labels),
    homepage_url       = COALESCE($6, homepage_url),
    report_recipients  = COALESCE($7, report_recipients),
    metadata           = COALESCE($8, metadata),
    updated_at         = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id, name, slug, description, owner, labels, homepage_url, report_recipients, metadata, created_at, updated_at;
