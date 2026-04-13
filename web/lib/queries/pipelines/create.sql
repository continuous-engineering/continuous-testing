INSERT INTO pipelines (tenant_id, project_id, name, description, runs_on, tags)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, $3,
  $4::text[],
  $5::text[]
)
RETURNING id, name, description, runs_on, tags, project_id, created_at, updated_at;
