UPDATE runs SET
  total_steps   = (SELECT COUNT(*)    FROM run_results WHERE run_id = $1),
  passed_steps  = (SELECT COUNT(*)    FROM run_results WHERE run_id = $1 AND status = 'passed'),
  failed_steps  = (SELECT COUNT(*)    FROM run_results WHERE run_id = $1 AND status = 'failed'),
  skipped_steps = (SELECT COUNT(*)    FROM run_results WHERE run_id = $1 AND status = 'skipped')
WHERE id = $1;
