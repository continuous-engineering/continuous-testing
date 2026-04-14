UPDATE dataset_rows
SET data = $2::jsonb
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
RETURNING id, row_index, data;
