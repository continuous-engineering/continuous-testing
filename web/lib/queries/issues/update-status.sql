UPDATE issues
SET status     = $2::issue_status,
    assignee   = COALESCE($3, assignee),
    updated_at = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
RETURNING id, status, assignee, updated_at;
