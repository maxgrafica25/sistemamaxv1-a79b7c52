ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS event_at timestamptz NULL;

UPDATE public.reminders
  SET event_at = remind_at
  WHERE event_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_user_event
  ON public.reminders (user_id, event_at)
  WHERE cancelled_at IS NULL;