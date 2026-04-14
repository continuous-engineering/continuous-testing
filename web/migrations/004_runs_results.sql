-- Migration 004: runs, run_results, ctx_snapshots

CREATE TYPE run_status  AS ENUM ('pending', 'running', 'passed', 'failed', 'cancelled');
CREATE TYPE step_status AS ENUM ('pending', 'running', 'passed', 'failed', 'skipped', 'blocked');

CREATE TABLE runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pipeline_id     UUID NOT NULL REFERENCES pipelines(id),
  environment_id  UUID REFERENCES environments(id),
  runner_id       UUID,                   -- set when runner claims
  status          run_status NOT NULL DEFAULT 'pending',
  trigger         TEXT NOT NULL DEFAULT 'manual',  -- manual | webhook | schedule | ci
  triggered_by    TEXT,                   -- clerk_user_id or 'system'
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  -- Billing: tracked minutes on this runner for this run
  runner_minutes  NUMERIC(10, 4),         -- set on completion: (completed_at - started_at) in minutes
  -- Aggregate counts (denormalized for fast dashboard queries)
  total_steps     INT NOT NULL DEFAULT 0,
  passed_steps    INT NOT NULL DEFAULT 0,
  failed_steps    INT NOT NULL DEFAULT 0,
  skipped_steps   INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE run_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id        UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  step_id       UUID NOT NULL REFERENCES steps(id),
  status        step_status NOT NULL DEFAULT 'pending',
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  duration_ms   INT,
  -- Captured outputs for context binding
  ctx_outputs   JSONB NOT NULL DEFAULT '{}',
  -- Full response captured for assertions + snapshot diffing
  response_body TEXT,
  response_meta JSONB NOT NULL DEFAULT '{}',  -- status_code, headers, score, etc.
  -- Assertion results
  assertions    JSONB NOT NULL DEFAULT '[]',  -- [{name, passed, expected, actual}]
  error_message TEXT,
  -- Artifacts stored in S3 (video, trace, screenshot paths)
  artifacts     JSONB NOT NULL DEFAULT '[]',  -- [{type, url, size_bytes}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Billing rollup: runner minutes per tenant per month
CREATE TABLE usage_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id         UUID NOT NULL REFERENCES runs(id),
  runner_id      UUID NOT NULL,
  runner_scope   TEXT NOT NULL,           -- 'hosted' | 'self-hosted'
  minutes        NUMERIC(10, 4) NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_period TEXT NOT NULL            -- 'YYYY-MM' for monthly rollup
);

ALTER TABLE runs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_results  ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON runs
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON run_results
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON usage_ledger
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_runs_pipeline   ON runs(pipeline_id, created_at DESC);
CREATE INDEX idx_runs_tenant     ON runs(tenant_id, created_at DESC);
CREATE INDEX idx_runs_status     ON runs(status) WHERE status IN ('pending', 'running');
CREATE INDEX idx_results_run     ON run_results(run_id);
CREATE INDEX idx_results_step    ON run_results(step_id, status);
CREATE INDEX idx_usage_tenant_period ON usage_ledger(tenant_id, billing_period);
