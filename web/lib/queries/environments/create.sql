INSERT INTO environments (tenant_id, project_id, name, is_default, variables)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, $3, $4::jsonb
)
RETURNING id, name, is_default, variables, created_at, updated_at;
