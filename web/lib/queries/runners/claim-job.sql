-- ADR-001: Tag-based dispatch. required_tags <@ runner.tags (required is subset of runner's tags)
-- FOR UPDATE SKIP LOCKED: concurrent runners safe, no double-claim
--
-- Tenant scoping:
--   hosted runners ($4='hosted'): claim jobs from ANY tenant — platform infrastructure serves all customers
--   self-hosted runners ($4='self-hosted'): claim jobs from their own tenant only
UPDATE runner_jobs
SET status     = 'claimed',
    runner_id  = $1,
    claimed_at = now()
WHERE id = (
  SELECT j.id
  FROM runner_jobs j
  WHERE j.status        = 'pending'
    AND (j.tenant_id = $2 OR $4 = 'hosted')
    AND j.required_tags <@ $3::text[]
  ORDER BY j.priority DESC, j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, run_id, required_tags, tenant_id;
