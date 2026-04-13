UPDATE runners
SET last_seen_at = now(), status = 'idle'
WHERE id = $1
  AND revoked_at IS NULL
RETURNING id, status;
