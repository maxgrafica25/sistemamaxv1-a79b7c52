UPDATE public.reminders
SET cancelled_at = now(),
    cancelled_reason = 'user_cancelled',
    updated_at = now()
WHERE title ILIKE 'Academia'
  AND event_at >= '2026-04-27T00:00:00-03:00'
  AND event_at <  '2026-04-28T00:00:00-03:00'
  AND cancelled_at IS NULL;