-- Migration 000: seed test tenant for local development / CI test mode
-- Only runs when CT_TEST_API_KEY is set. Idempotent.

INSERT INTO tenants (id, clerk_org_id, name, slug, plan)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'org_test_local',
  'CT Self-Test',
  'ct-self-test',
  'team'
)
ON CONFLICT (id) DO NOTHING;
