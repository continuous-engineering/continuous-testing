-- Claim next matching pending job for this runner.
-- FOR UPDATE SKIP LOCKED: concurrent runners are safe, no double-claim.
--
-- Tag dispatch (ADR-001): required_tags must be a subset of the runner's tags.
--
-- Tenant scoping:
--   hosted runners ($4='hosted', tenant_id IS NULL): claim jobs from ANY tenant.
--     RLS bypass is set via app.is_hosted_runner='true' in the calling transaction.
--   self-hosted runners ($4='self-hosted'): claim only their own tenant's jobs.
UPDATE runner_jobs
SET status     = 'claimed',
    runner_id  = $1,
    claimed_at = now()
WHERE id = (
  SELECT j.id
  FROM runner_jobs j
  WHERE j.status        = 'pending'
    AND ($4 = 'hosted' OR j.tenant_id = $2)
    AND j.required_tags <@ $3::text[]
  ORDER BY j.priority DESC, j.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED
)
RETURNING id, run_id, tenant_id, required_tags;
