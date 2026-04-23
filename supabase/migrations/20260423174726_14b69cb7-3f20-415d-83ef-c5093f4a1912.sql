
ALTER TABLE public.reminders
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancelled_reason text NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_user_active
  ON public.reminders (user_id, remind_at)
  WHERE cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION public.enqueue_gcal_sync()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_has_token boolean;
  v_user_id uuid;
  v_payload jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.user_google_tokens WHERE user_id = v_user_id)
    INTO v_has_token;
  IF NOT v_has_token THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.gcal_sync_queue (reminder_id, user_id, operation, payload)
    VALUES (NEW.id, NEW.user_id, 'create', '{}'::jsonb);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Soft-delete: cancelamento agora vira DELETE no Google Calendar
    IF OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL THEN
      v_payload := jsonb_build_object('google_event_id', NEW.google_event_id);
      INSERT INTO public.gcal_sync_queue (reminder_id, user_id, operation, payload)
      VALUES (NEW.id, NEW.user_id, 'delete', v_payload);
    ELSE
      INSERT INTO public.gcal_sync_queue (reminder_id, user_id, operation, payload)
      VALUES (NEW.id, NEW.user_id, 'update', '{}'::jsonb);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object('google_event_id', OLD.google_event_id);
    INSERT INTO public.gcal_sync_queue (reminder_id, user_id, operation, payload)
    VALUES (OLD.id, OLD.user_id, 'delete', v_payload);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;
