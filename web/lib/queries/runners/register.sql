-- Tenant-registered runners are ALWAYS self-hosted and tied to the registering tenant.
-- The 'hosted' scope is reserved for platform infrastructure — never accepted from API callers.
-- scope is hardcoded to 'self-hosted' here; the API also enforces this in route code.
INSERT INTO runners (tenant_id, name, scope, tags, capabilities, token_hash, registered_by)
VALUES ($1, $2, 'self-hosted', $3::text[], $4::text[], $5, $6)
RETURNING id, name, scope, tags, capabilities, status, created_at;
