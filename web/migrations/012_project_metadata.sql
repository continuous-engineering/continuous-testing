-- Migration 012: project metadata fields
-- Adds owner, labels, homepage_url, report_recipients, and open-ended metadata JSONB.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS owner            TEXT,
  ADD COLUMN IF NOT EXISTS labels           TEXT[]  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS homepage_url     TEXT,
  ADD COLUMN IF NOT EXISTS report_recipients TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS metadata         JSONB   NOT NULL DEFAULT '{}';

COMMENT ON COLUMN projects.owner             IS 'Person or team responsible for this project';
COMMENT ON COLUMN projects.labels            IS 'Free-form labels, e.g. production, mobile, critical';
COMMENT ON COLUMN projects.homepage_url      IS 'Base URL of the system under test';
COMMENT ON COLUMN projects.report_recipients IS 'Email addresses that receive test run reports';
COMMENT ON COLUMN projects.metadata          IS 'Open key-value store for any extra project info';
