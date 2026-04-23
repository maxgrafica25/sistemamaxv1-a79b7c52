-- 1. Tabela de tokens do Google por usuário
CREATE TABLE public.user_google_tokens (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text NOT NULL,
  email_google text,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own google tokens"
  ON public.user_google_tokens FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users delete own google tokens"
  ON public.user_google_tokens FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE TRIGGER trg_user_google_tokens_updated_at
  BEFORE UPDATE ON public.user_google_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Colunas em reminders
ALTER TABLE public.reminders
  ADD COLUMN google_event_id text,
  ADD COLUMN gcal_synced_at timestamptz;

-- 3. Fila de sincronização
CREATE TABLE public.gcal_sync_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reminder_id uuid,
  user_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('create','update','delete')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_gcal_sync_queue_pending
  ON public.gcal_sync_queue (created_at)
  WHERE processed_at IS NULL;

ALTER TABLE public.gcal_sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own sync queue"
  ON public.gcal_sync_queue FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 4. Trigger para enfileirar mudanças em reminders
CREATE OR REPLACE FUNCTION public.enqueue_gcal_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    INSERT INTO public.gcal_sync_queue (reminder_id, user_id, operation, payload)
    VALUES (NEW.id, NEW.user_id, 'update', '{}'::jsonb);
  ELSIF TG_OP = 'DELETE' THEN
    v_payload := jsonb_build_object('google_event_id', OLD.google_event_id);
    INSERT INTO public.gcal_sync_queue (reminder_id, user_id, operation, payload)
    VALUES (OLD.id, OLD.user_id, 'delete', v_payload);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_reminders_gcal_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.reminders
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_gcal_sync();