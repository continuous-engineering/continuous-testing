-- Migration 001: tenants, projects, memberships
-- All tables follow: tenant_id, created_at, updated_at, deleted_at (soft delete)

CREATE TYPE member_role AS ENUM ('admin', 'member', 'viewer');

CREATE TABLE tenants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id  TEXT UNIQUE NOT NULL,   -- Clerk organization ID
  name          TEXT NOT NULL,
  slug          TEXT UNIQUE NOT NULL,
  plan          TEXT NOT NULL DEFAULT 'starter', -- starter | team | enterprise
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);

CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  UNIQUE (tenant_id, slug)
);

CREATE TABLE memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,
  role        member_role NOT NULL DEFAULT 'member',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, clerk_user_id)
);

-- RLS
ALTER TABLE tenants    ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;

-- App sets tenant_id via: SET LOCAL app.tenant_id = '...'
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON memberships
  USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE INDEX idx_projects_tenant    ON projects(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_memberships_tenant ON memberships(tenant_id);
