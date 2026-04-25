-- 1. Tabela reading_alerts_sent
CREATE TABLE public.reading_alerts_sent (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id uuid NOT NULL,
  gap_start_date date NOT NULL,
  days_overdue integer NOT NULL,
  severity text NOT NULL DEFAULT 'reminder',
  is_first_critical boolean NOT NULL DEFAULT false,
  channel text NOT NULL DEFAULT 'chat',
  alerted_at timestamptz NOT NULL DEFAULT now(),
  alerted_on date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  resolved_at timestamptz,
  CONSTRAINT reading_alerts_sent_severity_chk CHECK (severity IN ('reminder', 'critical')),
  CONSTRAINT reading_alerts_sent_channel_chk CHECK (channel IN ('chat', 'inbox'))
);

CREATE INDEX idx_reading_alerts_sent_equipment ON public.reading_alerts_sent(equipment_id);
CREATE INDEX idx_reading_alerts_sent_unresolved ON public.reading_alerts_sent(equipment_id) WHERE resolved_at IS NULL;
CREATE UNIQUE INDEX idx_reading_alerts_sent_dedup
  ON public.reading_alerts_sent(equipment_id, gap_start_date, channel, alerted_on);
CREATE UNIQUE INDEX idx_reading_alerts_first_critical
  ON public.reading_alerts_sent(is_first_critical) WHERE is_first_critical = true;

ALTER TABLE public.reading_alerts_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read reading_alerts_sent"
  ON public.reading_alerts_sent FOR SELECT TO authenticated
  USING (public.is_profile_admin(auth.uid()));

-- 2. Tabela alert_recipients
CREATE TABLE public.alert_recipients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  user_id uuid,
  external_email text,
  notify_chat boolean NOT NULL DEFAULT true,
  notify_inbox boolean NOT NULL DEFAULT true,
  notify_email boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_recipients_active ON public.alert_recipients(active) WHERE active = true;

ALTER TABLE public.alert_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read alert_recipients"
  ON public.alert_recipients FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins can insert alert_recipients"
  ON public.alert_recipients FOR INSERT TO authenticated
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can update alert_recipients"
  ON public.alert_recipients FOR UPDATE TO authenticated
  USING (public.is_profile_admin(auth.uid()))
  WITH CHECK (public.is_profile_admin(auth.uid()));

CREATE POLICY "Admins can delete alert_recipients"
  ON public.alert_recipients FOR DELETE TO authenticated
  USING (public.is_profile_admin(auth.uid()));

CREATE TRIGGER trg_alert_recipients_updated_at
  BEFORE UPDATE ON public.alert_recipients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Trigger: resolver alertas quando uma leitura diária é registrada
CREATE OR REPLACE FUNCTION public.resolve_overdue_alerts_on_reading()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.type = 'daily' AND NEW.equipment_id IS NOT NULL THEN
    UPDATE public.reading_alerts_sent
       SET resolved_at = now()
     WHERE equipment_id = NEW.equipment_id
       AND resolved_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_resolve_overdue_alerts_on_reading
  AFTER INSERT ON public.printer_readings
  FOR EACH ROW EXECUTE FUNCTION public.resolve_overdue_alerts_on_reading();