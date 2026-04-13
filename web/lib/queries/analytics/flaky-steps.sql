-- Flaky step detection: steps with 5-95% fail rate over last 30 days, min 5 runs
SELECT
  s.id                                          AS step_id,
  s.name                                        AS step_name,
  s.type                                        AS step_type,
  p.id                                          AS pipeline_id,
  p.name                                        AS pipeline_name,
  proj.id                                       AS project_id,
  COUNT(rr.id)                                  AS total_runs,
  SUM(CASE WHEN rr.status = 'failed'  THEN 1 ELSE 0 END) AS failures,
  ROUND(
    SUM(CASE WHEN rr.status = 'failed' THEN 1 ELSE 0 END) * 100.0 / COUNT(rr.id),
    1
  )                                             AS fail_pct
FROM run_results rr
JOIN steps      s    ON s.id    = rr.step_id
JOIN pipelines  p    ON p.id    = s.pipeline_id
JOIN projects   proj ON proj.id = p.project_id
WHERE rr.tenant_id  = current_setting('app.tenant_id')::uuid
  AND rr.created_at > NOW() - INTERVAL '30 days'
GROUP BY s.id, s.name, s.type, p.id, p.name, proj.id
HAVING COUNT(rr.id) >= 5
   AND ROUND(SUM(CASE WHEN rr.status = 'failed' THEN 1 ELSE 0 END) * 100.0 / COUNT(rr.id), 1)
       BETWEEN 5 AND 95
ORDER BY fail_pct DESC
LIMIT 50;
