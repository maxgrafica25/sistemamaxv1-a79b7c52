DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'backup_runs_format_check') THEN
    ALTER TABLE public.backup_runs DROP CONSTRAINT backup_runs_format_check;
  END IF;
END $$;

ALTER TABLE public.backup_runs
  ADD CONSTRAINT backup_runs_format_check
  CHECK (format IN ('sql', 'json', 'storage-json'));