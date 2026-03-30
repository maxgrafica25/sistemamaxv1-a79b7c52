ALTER TABLE public.productive_capacity ADD COLUMN hours_per_month numeric NOT NULL DEFAULT 147;
ALTER TABLE public.productive_capacity DROP COLUMN working_days_per_month;
ALTER TABLE public.productive_capacity DROP COLUMN hours_per_day;