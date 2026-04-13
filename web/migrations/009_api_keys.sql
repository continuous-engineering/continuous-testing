-- Migration 009: API keys for CI/CD webhook triggers
-- Separate from runner tokens — these are for programmatic access (GitHub Actions, etc.)

CREATE TABLE api_keys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,          -- human label e.g. "github-actions-prod"
  key_hash    TEXT NOT NULL UNIQUE,   -- SHA-256 of the key (never store plaintext)
  last_used_at TIMESTAMPTZ,
  created_by  TEXT NOT NULL,          -- clerk_user_id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at  TIMESTAMPTZ
);

ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON api_keys
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_api_keys_hash   ON api_keys(key_hash) WHERE revoked_at IS NULL;
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id) WHERE revoked_at IS NULL;
