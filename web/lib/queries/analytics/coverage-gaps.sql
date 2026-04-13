-- Coverage: OpenAPI endpoints not covered by any step, per spec
SELECT
  spec.id          AS spec_id,
  spec.name        AS spec_name,
  spec.project_id,
  snap.coverage_pct,
  snap.covered_count,
  snap.uncovered_count,
  snap.endpoints   AS endpoint_details,
  snap.computed_at
FROM coverage_snapshots snap
JOIN openapi_specs spec ON spec.id = snap.spec_id
WHERE snap.tenant_id = current_setting('app.tenant_id')::uuid
  AND snap.computed_at = (
    SELECT MAX(s2.computed_at) FROM coverage_snapshots s2 WHERE s2.spec_id = snap.spec_id
  )
ORDER BY snap.coverage_pct ASC;
