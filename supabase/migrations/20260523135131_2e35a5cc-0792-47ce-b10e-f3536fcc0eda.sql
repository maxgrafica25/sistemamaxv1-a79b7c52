ALTER TABLE public.product_preset_processes
ADD COLUMN IF NOT EXISTS link_type text NOT NULL DEFAULT 'fixed'
CHECK (link_type IN ('fixed','optional'));