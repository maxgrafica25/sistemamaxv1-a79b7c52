-- Cria bucket privado para pacotes de migração VPS
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vps-packages',
  'vps-packages',
  false,
  5368709120, -- 5 GB por arquivo
  ARRAY['application/zip', 'application/octet-stream']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Apenas admins podem listar/baixar
CREATE POLICY "Admins podem listar pacotes VPS"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'vps-packages'
    AND public.is_profile_admin(auth.uid())
  );

-- Apenas admins podem subir (usado pela edge function via service role, mas mantém defesa em profundidade)
CREATE POLICY "Admins podem criar pacotes VPS"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vps-packages'
    AND public.is_profile_admin(auth.uid())
  );

-- Apenas admins podem apagar
CREATE POLICY "Admins podem apagar pacotes VPS"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vps-packages'
    AND public.is_profile_admin(auth.uid())
  );