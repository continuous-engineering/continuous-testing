-- Migration 005: issues, issue_refs, sync_log

CREATE TYPE issue_status   AS ENUM ('open', 'acknowledged', 'in_progress', 'resolved');
CREATE TYPE issue_severity AS ENUM ('low', 'medium', 'high', 'critical');

CREATE TABLE issues (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       issue_status   NOT NULL DEFAULT 'open',
  severity     issue_severity NOT NULL DEFAULT 'medium',
  assignee     TEXT,           -- display name from external system
  -- Source linkage
  run_id       UUID REFERENCES runs(id),
  step_id      UUID REFERENCES steps(id),
  -- Dedup key: same step + pipeline = same issue
  dedup_key    TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, dedup_key)
);

-- External system links (one issue can be linked to multiple systems)
CREATE TABLE issue_refs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  adapter     TEXT NOT NULL,        -- 'jira' | 'github' | 'linear'
  external_id TEXT NOT NULL,
  url         TEXT NOT NULL,
  synced_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (issue_id, adapter)
);

-- Append-only sync audit trail
CREATE TABLE sync_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  issue_id    UUID NOT NULL REFERENCES issues(id) ON DELETE CASCADE,
  adapter     TEXT NOT NULL,
  direction   TEXT NOT NULL,        -- 'push' | 'pull' | 'webhook'
  status      TEXT NOT NULL,        -- 'success' | 'error'
  error_msg   TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE issues    ENABLE ROW LEVEL SECURITY;
ALTER TABLE issue_refs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_log  ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON issues
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON issue_refs
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
CREATE POLICY tenant_isolation ON sync_log
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_issues_project   ON issues(project_id, status);
CREATE INDEX idx_issues_dedup     ON issues(tenant_id, dedup_key);
CREATE INDEX idx_sync_log_pending ON sync_log(tenant_id, status) WHERE status = 'error';
