SELECT p.id, p.name, p.description, p.runs_on, p.tags, p.created_at, p.updated_at,
       COUNT(s.id) FILTER (WHERE s.deleted_at IS NULL) AS step_count
FROM pipelines p
LEFT JOIN steps s ON s.pipeline_id = p.id
WHERE p.project_id = $1
  AND p.tenant_id  = current_setting('app.tenant_id')::uuid
  AND p.deleted_at IS NULL
GROUP BY p.id
ORDER BY p.name ASC;
