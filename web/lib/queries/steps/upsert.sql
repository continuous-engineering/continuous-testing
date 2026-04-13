INSERT INTO steps (id, tenant_id, pipeline_id, name, type, prerequisites, outputs, config, on_failure, timeout_ms, position)
VALUES (
  COALESCE($1, gen_random_uuid()),
  current_setting('app.tenant_id')::uuid,
  $2, $3, $4::step_type,
  $5::uuid[],
  $6::jsonb,
  $7::jsonb,
  $8,
  $9,
  $10
)
ON CONFLICT (id) DO UPDATE
SET name          = EXCLUDED.name,
    prerequisites = EXCLUDED.prerequisites,
    outputs       = EXCLUDED.outputs,
    config        = EXCLUDED.config,
    on_failure    = EXCLUDED.on_failure,
    timeout_ms    = EXCLUDED.timeout_ms,
    position      = EXCLUDED.position,
    updated_at    = now()
RETURNING id, name, type, prerequisites, outputs, config, on_failure, timeout_ms, position;
