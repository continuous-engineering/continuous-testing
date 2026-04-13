INSERT INTO issues (tenant_id, project_id, title, description, status, severity, run_id, step_id, dedup_key)
VALUES (
  current_setting('app.tenant_id')::uuid,
  $1, $2, $3, 'open'::issue_status, $4::issue_severity,
  $5, $6, $7
)
ON CONFLICT (tenant_id, dedup_key) DO UPDATE
SET last_seen_at = now(),
    status = CASE
      WHEN issues.status = 'resolved' THEN 'open'  -- reopen on regression
      ELSE issues.status
    END,
    updated_at = now()
RETURNING id, title, status, dedup_key,
  (xmax = 0) AS is_new;  -- true if inserted, false if updated (regression)
