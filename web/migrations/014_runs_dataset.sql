-- Migration 014: link runs to datasets for parameterised test execution
--
-- batch_id     — UUID shared by all runs triggered from the same dataset
-- dataset_id   — the dataset used (nullable — single runs have no dataset)
-- row_data     — snapshot of the dataset row at trigger time (JSONB)
--                Snapshotted so dataset edits don't affect in-flight runs
-- row_index    — which row (0-based) this run covers

ALTER TABLE runs
  ADD COLUMN IF NOT EXISTS batch_id     UUID,
  ADD COLUMN IF NOT EXISTS dataset_id  UUID REFERENCES datasets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS row_data    JSONB,
  ADD COLUMN IF NOT EXISTS row_index   INT;

CREATE INDEX IF NOT EXISTS idx_runs_batch ON runs(batch_id) WHERE batch_id IS NOT NULL;
