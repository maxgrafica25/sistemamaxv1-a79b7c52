ALTER TABLE public.global_settings
  ADD COLUMN IF NOT EXISTS checklist_before_save boolean NOT NULL DEFAULT true;