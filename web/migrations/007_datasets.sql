-- Migration 007: datasets + dataset_rows (parameterized test data)

CREATE TABLE datasets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  -- JSON schema defining the shape of each row
  schema_json JSONB NOT NULL DEFAULT '{}',
  row_count   INT   NOT NULL DEFAULT 0,  -- denormalized, updated on row insert/delete
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE dataset_rows (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  row_index  INT  NOT NULL,
  data       JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, row_index)
);

ALTER TABLE datasets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE dataset_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON datasets
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON dataset_rows
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_datasets_project ON datasets(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_dataset_rows     ON dataset_rows(dataset_id, row_index);
