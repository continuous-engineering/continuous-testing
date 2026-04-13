-- Dashboard: runner status summary
SELECT
  scope,
  status,
  COUNT(*) AS count
FROM runners
WHERE (tenant_id = current_setting('app.tenant_id')::uuid OR scope = 'hosted')
  AND revoked_at IS NULL
GROUP BY scope, status
ORDER BY scope, status;
