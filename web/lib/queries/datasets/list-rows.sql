SELECT id, row_index, data
FROM dataset_rows
WHERE dataset_id = $1
  AND tenant_id  = current_setting('app.tenant_id')::uuid
ORDER BY row_index ASC
LIMIT $2 OFFSET $3;
