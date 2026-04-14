DELETE FROM dataset_rows
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
RETURNING id;
