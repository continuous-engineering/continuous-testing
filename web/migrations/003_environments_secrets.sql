-- Migration 003: environments + secrets vault

CREATE TABLE environments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  -- Plain key-value pairs (non-sensitive)
  variables   JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (project_id, name)
);

CREATE TABLE secrets (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  project_id      UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- referenced as {{secrets.NAME}} in steps
  -- AES-256-GCM encrypted. key derived from tenant master key (envelope encryption).
  -- Value NEVER returned in API responses. Ever.
  encrypted_value TEXT NOT NULL,
  key_version     INT  NOT NULL DEFAULT 1,
  -- Usage tracking (updated by app layer when job context is built)
  last_used_at    TIMESTAMPTZ,
  use_count       INT NOT NULL DEFAULT 0,
  created_by      TEXT NOT NULL,          -- clerk_user_id
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE (project_id, name)
);

ALTER TABLE environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE secrets       ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON environments
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Secrets policy: tenant isolation enforced + encrypted_value never in SELECT *
-- App layer must explicitly exclude encrypted_value in all queries
CREATE POLICY tenant_isolation ON secrets
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_environments_project ON environments(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_secrets_project       ON secrets(project_id)      WHERE deleted_at IS NULL;
