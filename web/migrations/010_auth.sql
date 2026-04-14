-- Migration 010: own auth — users, orgs, sessions
-- Replaces Clerk. All auth is internal. JWT sessions via httpOnly cookies.

CREATE TABLE users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL DEFAULT '',
  password_hash TEXT NOT NULL,             -- bcrypt, never returned via API
  email_verified BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at   TIMESTAMPTZ
);

CREATE TYPE org_plan AS ENUM ('starter','team','scale','enterprise');

CREATE TABLE orgs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  plan       org_plan NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE org_role AS ENUM ('admin','member','viewer');

CREATE TABLE org_members (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id  UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role    org_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- Sessions: JWT sessions stored server-side for immediate revocation capability
CREATE TABLE sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id     UUID REFERENCES orgs(id) ON DELETE SET NULL,  -- active org context
  token_hash TEXT NOT NULL UNIQUE,   -- SHA-256 of JWT jti — for revocation lookup
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen  TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip         TEXT
);

-- Org invitations
CREATE TABLE org_invitations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  role       org_role NOT NULL DEFAULT 'member',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update tenants to reference orgs (keep clerk_org_id for backwards compat but nullable)
ALTER TABLE tenants ALTER COLUMN clerk_org_id DROP NOT NULL;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES orgs(id);

CREATE INDEX idx_sessions_token  ON sessions(token_hash) WHERE expires_at > now();
CREATE INDEX idx_sessions_user   ON sessions(user_id);
CREATE INDEX idx_org_members_org ON org_members(org_id);
CREATE INDEX idx_users_email     ON users(email) WHERE deleted_at IS NULL;
