
-- Table for production losses/waste tracking
CREATE TABLE public.production_losses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  operator_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  error_type TEXT NOT NULL DEFAULT 'operational', -- 'operational' or 'equipment'
  description TEXT NOT NULL DEFAULT '',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_losses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read production_losses" ON public.production_losses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert production_losses" ON public.production_losses FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update production_losses" ON public.production_losses FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete production_losses" ON public.production_losses FOR DELETE TO authenticated USING (true);

-- Table for maintenance requests from operators
CREATE TABLE public.maintenance_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  requested_by TEXT NOT NULL,
  description TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved'
  attachments TEXT[] DEFAULT '{}'::text[],
  admin_notes TEXT,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read maintenance_requests" ON public.maintenance_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert maintenance_requests" ON public.maintenance_requests FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update maintenance_requests" ON public.maintenance_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated can delete maintenance_requests" ON public.maintenance_requests FOR DELETE TO authenticated USING (true);
