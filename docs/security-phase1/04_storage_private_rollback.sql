-- Rollback do item 4
BEGIN;

UPDATE storage.buckets
   SET public = true,
       file_size_limit = NULL,
       allowed_mime_types = NULL
 WHERE id IN ('chat-attachments', 'maintenance-attachments');

DROP POLICY IF EXISTS "Auth view maintenance attachments"                ON storage.objects;
DROP POLICY IF EXISTS "Auth upload maintenance attachments (owner)"      ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete maintenance attachments"    ON storage.objects;
DROP POLICY IF EXISTS "Auth view chat attachments"                       ON storage.objects;
DROP POLICY IF EXISTS "Auth upload chat attachments (owner)"             ON storage.objects;
DROP POLICY IF EXISTS "Owner or admin delete chat attachments"           ON storage.objects;

CREATE POLICY "Anyone can view maintenance attachments"
  ON storage.objects FOR SELECT USING (bucket_id = 'maintenance-attachments');
CREATE POLICY "Authenticated users can upload maintenance attachments"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'maintenance-attachments');
CREATE POLICY "Authenticated users can delete maintenance attachments"
  ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'maintenance-attachments');
CREATE POLICY "Auth upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'chat-attachments');
CREATE POLICY "Auth view chat attachments"
  ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'chat-attachments');

COMMIT;
