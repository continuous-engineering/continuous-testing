-- ADR-002: append-only billing ledger
INSERT INTO usage_ledger (tenant_id, run_id, runner_id, runner_scope, minutes, billing_period)
VALUES ($1::uuid, $2::uuid, $3::uuid, $4::runner_scope, $5::numeric, to_char(now(), 'YYYY-MM'));
