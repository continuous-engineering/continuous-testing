-- Migration 006: runners + runner_jobs + usage_ledger
-- ADR-001: DAG = unit of work = one runner. runs_on on pipeline only.
-- ADR-002: runner_minutes tracked per run for usage-based billing.

CREATE TYPE runner_scope  AS ENUM ('hosted', 'self-hosted');
CREATE TYPE runner_status AS ENUM ('idle', 'busy', 'offline');

CREATE TABLE runners (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL for platform hosted runners
  name         TEXT NOT NULL,
  scope        runner_scope   NOT NULL DEFAULT 'self-hosted',
  status       runner_status  NOT NULL DEFAULT 'idle',
  tags         TEXT[]         NOT NULL DEFAULT '{}',
  -- Capabilities declared by runner on registration
  capabilities TEXT[]         NOT NULL DEFAULT '{"api"}',  -- api | ui | ai
  -- Token hash (never store plaintext token)
  token_hash   TEXT           NOT NULL,
  last_seen_at TIMESTAMPTZ,
  registered_by TEXT,         -- clerk_user_id (null for platform runners)
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);

CREATE TABLE runner_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id        UUID NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  runner_id     UUID REFERENCES runners(id),
  -- Tag-based dispatch: runner.tags must contain all required_tags
  -- Postgres: required_tags <@ runner.tags
  required_tags TEXT[] NOT NULL DEFAULT '{"hosted"}',
  priority      INT    NOT NULL DEFAULT 0,
  status        TEXT   NOT NULL DEFAULT 'pending',  -- pending | claimed | complete | failed
  claimed_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  error_msg     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Usage-based billing ledger (append-only, never update)
-- ADR-002: hosted minutes billed, self-hosted tracked only
CREATE TABLE usage_ledger (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  run_id         UUID NOT NULL REFERENCES runs(id),
  runner_id      UUID NOT NULL REFERENCES runners(id),
  runner_scope   runner_scope NOT NULL,
  minutes        NUMERIC(10, 4) NOT NULL,
  recorded_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  billing_period TEXT NOT NULL  -- 'YYYY-MM' for monthly rollup
);

ALTER TABLE runners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE runner_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;

-- Hosted runners (tenant_id IS NULL) visible to all tenants for job claiming
-- Self-hosted runners visible only to their tenant
CREATE POLICY runner_visibility ON runners
  USING (tenant_id IS NULL OR tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON runner_jobs
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON usage_ledger
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_runners_tags      ON runners USING GIN(tags);
CREATE INDEX idx_runners_scope     ON runners(scope, status) WHERE revoked_at IS NULL;
CREATE INDEX idx_runner_jobs_claim ON runner_jobs(status, required_tags) WHERE status = 'pending';
CREATE INDEX idx_usage_billing     ON usage_ledger(tenant_id, billing_period);
