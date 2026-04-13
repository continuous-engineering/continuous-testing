UPDATE pipelines
SET name        = COALESCE($2, name),
    description = COALESCE($3, description),
    runs_on     = COALESCE($4::text[], runs_on),
    tags        = COALESCE($5::text[], tags),
    updated_at  = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id, name, description, runs_on, tags, project_id, created_at, updated_at;
