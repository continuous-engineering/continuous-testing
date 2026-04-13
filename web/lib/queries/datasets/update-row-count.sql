UPDATE datasets
SET row_count = (SELECT COUNT(*) FROM dataset_rows WHERE dataset_id = $1),
    updated_at = now()
WHERE id = $1
  AND tenant_id = current_setting('app.tenant_id')::uuid
RETURNING row_count;
