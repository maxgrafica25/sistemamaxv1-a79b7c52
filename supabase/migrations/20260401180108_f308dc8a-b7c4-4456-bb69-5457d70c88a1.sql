
-- Add attachments column to equipment_maintenances
ALTER TABLE public.equipment_maintenances
ADD COLUMN attachments text[] DEFAULT '{}'::text[];

-- Create storage bucket for maintenance attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('maintenance-attachments', 'maintenance-attachments', true);

-- Storage policies
CREATE POLICY "Anyone can view maintenance attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'maintenance-attachments');

CREATE POLICY "Authenticated users can upload maintenance attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'maintenance-attachments');

CREATE POLICY "Authenticated users can delete maintenance attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'maintenance-attachments');
