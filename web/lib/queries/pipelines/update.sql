-- Route handler fetches existing values and passes merged result for $6/$7,
-- so NULL here means "clear" and any UUID means "set".
UPDATE pipelines
SET name                   = COALESCE($2, name),
    description            = COALESCE($3, description),
    runs_on                = COALESCE($4::text[], runs_on),
    tags                   = COALESCE($5::text[], tags),
    default_dataset_id     = $6::uuid,
    default_environment_id = $7::uuid,
    updated_at             = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
  AND deleted_at IS NULL
RETURNING id, name, description, runs_on, tags, project_id,
          default_dataset_id, default_environment_id, created_at, updated_at;
