-- Dashboard: run health for last 24 hours, grouped by status
SELECT
  status,
  COUNT(*)                                    AS count,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000)::int AS avg_duration_ms
FROM runs
WHERE tenant_id  = current_setting('app.tenant_id', true)::uuid
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
