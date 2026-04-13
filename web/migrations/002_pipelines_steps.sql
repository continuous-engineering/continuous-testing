-- Migration 002: pipelines + steps (DAG model)

CREATE TYPE step_type AS ENUM ('api', 'ui', 'ai');

CREATE TABLE pipelines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  runs_on     TEXT[] NOT NULL DEFAULT '{"hosted"}',  -- runner tag requirement for entire DAG
  tags        TEXT[] NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);

CREATE TABLE steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id   UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          step_type NOT NULL,
  -- DAG wiring
  prerequisites UUID[] NOT NULL DEFAULT '{}',   -- step IDs that must complete first
  -- Output declarations: { "token": "$.response.body.access_token" }
  outputs       JSONB NOT NULL DEFAULT '{}',
  -- Type-specific config — validated by application layer per type
  config        JSONB NOT NULL DEFAULT '{}',
  -- Execution policy
  on_failure    TEXT NOT NULL DEFAULT 'stop',   -- stop | continue
  timeout_ms    INT  NOT NULL DEFAULT 30000,
  position      INT  NOT NULL DEFAULT 0,        -- display order in linear view
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

-- Validate no self-references (cycles caught in app layer via Kahn's algo)
ALTER TABLE steps ADD CONSTRAINT step_no_self_prereq
  CHECK (NOT (id = ANY(prerequisites)));

-- RLS
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps     ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON pipelines
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON steps
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_pipelines_project ON pipelines(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_steps_pipeline    ON steps(pipeline_id)    WHERE deleted_at IS NULL;
CREATE INDEX idx_steps_type        ON steps(type);
