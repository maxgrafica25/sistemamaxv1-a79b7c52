
CREATE TABLE public.equipment_maintenances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id uuid NOT NULL REFERENCES public.equipments(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  maintenance_type text NOT NULL DEFAULT 'preventiva',
  technician text NOT NULL DEFAULT '',
  total_counter integer,
  hours_spent numeric NOT NULL DEFAULT 0,
  cost numeric NOT NULL DEFAULT 0,
  replaced_parts text,
  service_description text NOT NULL DEFAULT '',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment_maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to equipment_maintenances"
  ON public.equipment_maintenances
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);
