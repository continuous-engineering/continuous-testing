-- API keys for CI/CD webhook triggers (separate from runner tokens)
-- Table created in migration 009 (extend schema)
SELECT tenant_id, name, last_used_at
FROM api_keys
WHERE key_hash = $1
  AND revoked_at IS NULL;
