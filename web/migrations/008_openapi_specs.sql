-- Migration 008: openapi_specs + coverage_snapshots

CREATE TABLE openapi_specs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  version     TEXT,
  -- Full parsed OpenAPI JSON stored for analysis
  spec_json   JSONB NOT NULL,
  -- Summary counts extracted at upload time
  endpoint_count INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

-- Coverage snapshot per spec (recalculated after each run)
CREATE TABLE coverage_snapshots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spec_id     UUID NOT NULL REFERENCES openapi_specs(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Per-endpoint coverage: [{path, method, covered, step_ids[]}]
  endpoints   JSONB NOT NULL DEFAULT '[]',
  covered_count   INT NOT NULL DEFAULT 0,
  uncovered_count INT NOT NULL DEFAULT 0,
  coverage_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE openapi_specs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_snapshots  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON openapi_specs
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON coverage_snapshots
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_specs_project    ON openapi_specs(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_coverage_spec    ON coverage_snapshots(spec_id, computed_at DESC);
