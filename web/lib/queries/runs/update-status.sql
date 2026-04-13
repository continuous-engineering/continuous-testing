UPDATE runs
SET status        = $2,
    started_at    = CASE WHEN $2 = 'running'   THEN COALESCE(started_at, now()) ELSE started_at END,
    completed_at  = CASE WHEN $2 IN ('passed', 'failed', 'cancelled') THEN now() ELSE completed_at END,
    runner_id     = COALESCE($3, runner_id),
    runner_minutes = $4
WHERE id = $1
RETURNING id, status, started_at, completed_at, runner_minutes;
