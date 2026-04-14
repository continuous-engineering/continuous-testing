SELECT r.id, r.status, r.trigger, r.triggered_by,
       r.started_at, r.completed_at, r.runner_minutes,
       r.total_steps, r.passed_steps, r.failed_steps, r.skipped_steps,
       r.pipeline_id, r.environment_id,
       p.name AS pipeline_name, p.project_id,
       proj.name AS project_name,
       COALESCE(
         json_agg(
           json_build_object(
             'id',            rr.id,
             'step_id',       rr.step_id,
             'status',        rr.status,
             'started_at',    rr.started_at,
             'completed_at',  rr.completed_at,
             'duration_ms',   rr.duration_ms,
             'ctx_outputs',   rr.ctx_outputs,
             'response_meta', rr.response_meta,
             'assertions',    rr.assertions,
             'error_message', rr.error_message,
             'artifacts',     rr.artifacts
           ) ORDER BY rr.started_at
         ) FILTER (WHERE rr.id IS NOT NULL),
         '[]'
       ) AS step_results
FROM runs r
JOIN pipelines p    ON p.id    = r.pipeline_id
JOIN projects  proj ON proj.id = p.project_id
LEFT JOIN run_results rr ON rr.run_id = r.id
WHERE r.id = $1
  AND r.tenant_id = current_setting('app.tenant_id')::uuid
GROUP BY r.id, p.name, p.project_id, proj.name;
