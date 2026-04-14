INSERT INTO runs (
  tenant_id, pipeline_id, environment_id,
  dataset_id, row_data, row_index, batch_id,
  status, trigger, triggered_by
)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2,
  $3, $4::jsonb, $5, $6,
  'pending', $7, $8
)
RETURNING id, status, trigger, triggered_by, batch_id, row_index, created_at;
