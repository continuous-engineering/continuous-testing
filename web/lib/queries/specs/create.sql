INSERT INTO openapi_specs (tenant_id, project_id, name, version, spec_json, endpoint_count)
VALUES (current_setting('app.tenant_id')::uuid, $1, $2, $3, $4::jsonb, $5)
RETURNING id, name, version, endpoint_count, created_at;
