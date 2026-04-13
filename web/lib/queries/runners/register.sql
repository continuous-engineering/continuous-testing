INSERT INTO runners (tenant_id, name, scope, tags, capabilities, token_hash, registered_by)
VALUES ($1, $2, $3::runner_scope, $4::text[], $5::text[], $6, $7)
RETURNING id, name, scope, tags, capabilities, status, created_at;
