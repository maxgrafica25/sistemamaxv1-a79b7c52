UPDATE public.reminders
SET remind_at = event_at - interval '15 minutes',
    updated_at = now()
WHERE id = '1cd24fd0-7187-48c8-94ce-a64bfe516685'
  AND cancelled_at IS NULL;