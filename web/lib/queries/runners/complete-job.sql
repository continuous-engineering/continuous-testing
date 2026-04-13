UPDATE runner_jobs
SET status       = $2,
    completed_at = now(),
    error_msg    = $3
WHERE id = $1
RETURNING id, run_id;
