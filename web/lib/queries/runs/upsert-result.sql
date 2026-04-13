INSERT INTO run_results (tenant_id, run_id, step_id, status, started_at, completed_at, duration_ms, ctx_outputs, response_body, response_meta, assertions, error_message, artifacts)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, $3::step_status,
  $4, $5, $6,
  $7::jsonb, $8, $9::jsonb, $10::jsonb, $11,
  $12::jsonb
)
ON CONFLICT (run_id, step_id) DO UPDATE
SET status        = EXCLUDED.status,
    completed_at  = EXCLUDED.completed_at,
    duration_ms   = EXCLUDED.duration_ms,
    ctx_outputs   = EXCLUDED.ctx_outputs,
    response_body = EXCLUDED.response_body,
    response_meta = EXCLUDED.response_meta,
    assertions    = EXCLUDED.assertions,
    error_message = EXCLUDED.error_message,
    artifacts     = EXCLUDED.artifacts
RETURNING id;
