SELECT
  p.id, p.name, p.description, p.runs_on, p.tags,
  p.project_id, p.created_at, p.updated_at,
  COALESCE(
    json_agg(
      json_build_object(
        'id',            s.id,
        'name',          s.name,
        'type',          s.type,
        'prerequisites', s.prerequisites,
        'outputs',       s.outputs,
        'config',        s.config,
        'on_failure',    s.on_failure,
        'timeout_ms',    s.timeout_ms,
        'position',      s.position
      ) ORDER BY s.position
    ) FILTER (WHERE s.id IS NOT NULL AND s.deleted_at IS NULL),
    '[]'
  ) AS steps
FROM pipelines p
LEFT JOIN steps s ON s.pipeline_id = p.id
WHERE p.id = $1
  AND p.tenant_id = current_setting('app.tenant_id')::uuid
  AND p.deleted_at IS NULL
GROUP BY p.id;
