INSERT INTO dataset_rows (dataset_id, tenant_id, row_index, data)
SELECT $1, current_setting('app.tenant_id')::uuid, row_number() OVER () - 1 + $2, value
FROM jsonb_array_elements($3::jsonb) AS value
RETURNING id, row_index;
