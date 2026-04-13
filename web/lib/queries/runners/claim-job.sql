-- ADR-001: Tag-based dispatch. required_tags <@ runner.tags (required is subset of runner's tags)
-- FOR UPDATE SKIP LOCKED: concurrent runners safe, no double-claim
UPDATE runner_jobs
SET status     = 'claimed',
    runner_id  = $1,
    claimed_at = now()
WHERE id = (
  SELECT j.id
  FROM runner_jobs j
  WHERE j.status        = 'pending'
    AND j.tenant_id     = $2
    AND j.required_tags <@ $3::text[]
  ORDER BY j.priority DESC, j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, run_id, required_tags;
