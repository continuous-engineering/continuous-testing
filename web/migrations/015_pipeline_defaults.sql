-- Pipeline-level default dataset and environment.
-- Testers configure these once; the run modal pre-selects them automatically.
-- Both are nullable — pipelines without defaults work exactly as before.

ALTER TABLE pipelines
  ADD COLUMN default_dataset_id     UUID REFERENCES datasets(id)     ON DELETE SET NULL,
  ADD COLUMN default_environment_id UUID REFERENCES environments(id) ON DELETE SET NULL;
