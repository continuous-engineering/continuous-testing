#!/usr/bin/env bash
set -e
REPO="/mnt/c/Users/smand/src/continuous.engineering/continuous-testing"
cd "$REPO"

MIGRATIONS=(
  "web/migrations/001_tenants_projects.sql"
  "web/migrations/002_pipelines_steps.sql"
  "web/migrations/003_environments_secrets.sql"
  "web/migrations/004_runs_results.sql"
  "web/migrations/005_issues.sql"
  "web/migrations/006_runners.sql"
  "web/migrations/007_datasets.sql"
  "web/migrations/008_openapi_specs.sql"
  "web/migrations/009_api_keys.sql"
)

for f in "${MIGRATIONS[@]}"; do
  echo "Running $f..."
  docker compose --env-file .env.docker exec -T postgres \
    psql -U ct -d continuous_testing -q < "$f" 2>&1 | grep -v "^$" | head -5 || true
done

echo ""
echo "Seeding test tenant..."
docker compose --env-file .env.docker exec -T postgres \
  psql -U ct -d continuous_testing -q < web/migrations/000_test_tenant.sql 2>&1 | grep -v "^$" | head -3 || true

echo ""
echo "Seeding 3 runner tokens..."
PW="621c1299e62b9d8803e110d1ed455192f1987d10048a50b980c9ac6f9cab781a"
T1="cf912c1d2d12b06aefdfd0fa00b78bb5f48c5e760303c26998c4101d89936b2a"
T2="fdaf5822bf90619fdc069b91b9743ff8882e553940f996050c7d98a5606af5d6"
T3="1131b7cc3d73dad5b22625ddbe3db9e4ab7dbccff3333b50c61811ccb1d440f6"
TENANT="00000000-0000-0000-0000-000000000001"

H1=$(echo -n "$T1" | sha256sum | awk '{print $1}')
H2=$(echo -n "$T2" | sha256sum | awk '{print $1}')
H3=$(echo -n "$T3" | sha256sum | awk '{print $1}')

docker compose --env-file .env.docker exec -T postgres psql -U ct -d continuous_testing -q << SQL
INSERT INTO runners (id, tenant_id, name, scope, tags, capabilities, token_hash, registered_by, status)
VALUES
  ('00000001-0000-0000-0000-000000000001', '$TENANT', 'hosted-runner-1', 'hosted', ARRAY['hosted','api','ui','ai'], ARRAY['api','ui','ai'], '$H1', 'system', 'idle'),
  ('00000002-0000-0000-0000-000000000001', '$TENANT', 'hosted-runner-2', 'hosted', ARRAY['hosted','api','ui','ai'], ARRAY['api','ui','ai'], '$H2', 'system', 'idle'),
  ('00000003-0000-0000-0000-000000000001', '$TENANT', 'hosted-runner-3', 'hosted', ARRAY['hosted','api','ui','ai'], ARRAY['api','ui','ai'], '$H3', 'system', 'idle')
ON CONFLICT (id) DO UPDATE SET last_seen_at = now(), status = 'idle';
SQL
echo "Runners seeded."
echo ""
echo "All done!"
