UPDATE public.reminders
SET cancelled_at = now(),
    cancelled_reason = 'rescheduled',
    updated_at = now()
WHERE id = '41380526-7c2d-4c4f-9f7d-1234567890ab' OR (
  title ILIKE '%treino%'
  AND event_at = '2026-04-27T18:30:00+00:00'::timestamptz
  AND cancelled_at IS NULL
);