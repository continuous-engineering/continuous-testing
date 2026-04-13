INSERT INTO projects (tenant_id, name, slug, description)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, $3
)
RETURNING id, name, slug, description, created_at, updated_at;
