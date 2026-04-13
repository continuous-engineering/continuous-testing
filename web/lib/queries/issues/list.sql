SELECT
  i.id, i.title, i.status, i.severity, i.assignee,
  i.dedup_key, i.first_seen_at, i.last_seen_at,
  i.run_id, i.step_id,
  COALESCE(
    json_agg(
      json_build_object('adapter', ir.adapter, 'external_id', ir.external_id, 'url', ir.url)
    ) FILTER (WHERE ir.id IS NOT NULL),
    '[]'
  ) AS external_refs
FROM issues i
LEFT JOIN issue_refs ir ON ir.issue_id = i.id
WHERE i.tenant_id  = current_setting('app.tenant_id')::uuid
  AND i.project_id = $1
  AND ($2::text IS NULL OR i.status = $2)
GROUP BY i.id
ORDER BY i.last_seen_at DESC
LIMIT 100;
