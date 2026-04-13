SELECT id, status, trigger, triggered_by, started_at, completed_at,
       runner_minutes, total_steps, passed_steps, failed_steps, skipped_steps,
       created_at
FROM runs
WHERE pipeline_id = $1
  AND tenant_id   = current_setting('app.tenant_id')::uuid
ORDER BY created_at DESC
LIMIT 50;
