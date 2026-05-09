-- =============================================================================
-- Fase 1 / Item 4 — Buckets privados + ownership (ALTA)
-- =============================================================================
-- ⚠️  PRÉ-REQUISITO DE FRONTEND:
-- Substituir TODOS os usos de storage.from(...).getPublicUrl(...) por
-- createSignedUrl(path, 3600) nestes arquivos antes de aplicar:
--   - src/components/chat/ChatInput.tsx
--   - src/components/equipamentos/MaintenanceTab.tsx
--   - src/components/equipamentos/MaintenanceRequestsTab.tsx
-- Caso contrário, anexos param de carregar visualmente.
-- =============================================================================

BEGIN;

-- 1. Privatizar buckets + limites
UPDATE storage.buckets
   SET public = false,
       file_size_limit = 20971520,  -- 20 MiB
       allowed_mime_types = ARRAY[
         'image/jpeg', 'image/png', 'image/webp', 'image/gif',
         'application/pdf'
       ]::text[]
 WHERE id IN ('chat-attachments', 'maintenance-attachments');

-- 2. Reescrever policies de maintenance-attachments
DROP POLICY IF EXISTS "Anyone can view maintenance attachments"             ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload maintenance attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete maintenance attachments" ON storage.objects;

CREATE POLICY "Auth view maintenance attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'maintenance-attachments');

CREATE POLICY "Auth upload maintenance attachments (owner)"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'maintenance-attachments'
    AND owner = auth.uid()
  );

CREATE POLICY "Owner or admin delete maintenance attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'maintenance-attachments'
    AND (owner = auth.uid() OR public.is_profile_admin(auth.uid()))
  );

-- 3. Reescrever policies de chat-attachments (acrescentar DELETE para owner)
DROP POLICY IF EXISTS "Auth upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth view chat attachments"   ON storage.objects;

CREATE POLICY "Auth view chat attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Auth upload chat attachments (owner)"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND owner = auth.uid()
  );

CREATE POLICY "Owner or admin delete chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (owner = auth.uid() OR public.is_profile_admin(auth.uid()))
  );

COMMIT;
