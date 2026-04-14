-- Dashboard: recent runs across all pipelines (last 20)
SELECT
  r.id,
  r.status,
  r.trigger,
  r.triggered_by,
  r.started_at,
  r.completed_at,
  r.total_steps,
  r.passed_steps,
  r.failed_steps,
  r.skipped_steps,
  r.runner_minutes,
  p.id   AS pipeline_id,
  p.name AS pipeline_name,
  proj.id   AS project_id,
  proj.name AS project_name
FROM runs r
JOIN pipelines p    ON p.id    = r.pipeline_id
JOIN projects  proj ON proj.id = p.project_id
WHERE r.tenant_id = current_setting('app.tenant_id', true)::uuid
ORDER BY r.created_at DESC
LIMIT 20;
