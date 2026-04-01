
CREATE TABLE public.reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  remind_at TIMESTAMP WITH TIME ZONE NOT NULL,
  recurrence TEXT NOT NULL DEFAULT 'none',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  category TEXT NOT NULL DEFAULT 'custom',
  source_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reminders" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own reminders" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own reminders" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own reminders" ON public.reminders FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_reminders_updated_at BEFORE UPDATE ON public.reminders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
