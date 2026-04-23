-- Fix legacy reminders where event_at was backfilled from remind_at but the actual
-- appointment time is encoded in the title (e.g., "Treino às 11h", "Treino às 13h15").
-- Only touches pending (not cancelled, not completed) records to avoid rewriting history.

DO $$
DECLARE
  r record;
  v_match text[];
  v_hour int;
  v_min int;
  v_remind_date date;
  v_new_event timestamptz;
  v_clean_title text;
BEGIN
  FOR r IN
    SELECT id, title, remind_at, event_at
    FROM public.reminders
    WHERE cancelled_at IS NULL
      AND is_completed = false
      AND title ~* 'às\s+\d{1,2}h(\d{2})?'
  LOOP
    v_match := regexp_match(r.title, 'às\s+(\d{1,2})h(\d{2})?', 'i');
    IF v_match IS NULL THEN
      CONTINUE;
    END IF;
    v_hour := v_match[1]::int;
    v_min := COALESCE(NULLIF(v_match[2], '')::int, 0);

    -- Use the date from remind_at (in America/Sao_Paulo) and replace the time.
    v_remind_date := (r.remind_at AT TIME ZONE 'America/Sao_Paulo')::date;
    v_new_event := ((v_remind_date::text || ' ' || lpad(v_hour::text, 2, '0') || ':' || lpad(v_min::text, 2, '0') || ':00')::timestamp)
                   AT TIME ZONE 'America/Sao_Paulo';

    -- Clean title: remove " às XXh" / " às XXhMM" suffix
    v_clean_title := btrim(regexp_replace(r.title, '\s*às\s+\d{1,2}h(\d{2})?', '', 'gi'));
    IF v_clean_title = '' THEN
      v_clean_title := r.title;
    END IF;

    UPDATE public.reminders
       SET event_at = v_new_event,
           title = v_clean_title,
           updated_at = now()
     WHERE id = r.id;
  END LOOP;
END $$;