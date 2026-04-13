INSERT INTO runs (tenant_id, pipeline_id, environment_id, status, trigger, triggered_by)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, 'pending', $3, $4
)
RETURNING id, status, trigger, triggered_by, created_at;
