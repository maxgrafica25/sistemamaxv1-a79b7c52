-- 1. Convert chat-attachments to private
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';

-- 2. Drop existing policies to recreate them with company isolation
DROP POLICY IF EXISTS "Auth upload chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "Auth view chat attachments" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-attachments authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-attachments authenticated insert" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-attachments authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "maintenance-attachments authenticated delete" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_auth_select" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_auth_insert" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_auth_update" ON storage.objects;
DROP POLICY IF EXISTS "quote_attachments_auth_delete" ON storage.objects;

-- 3. Create helper function to check if two users belong to the same company
CREATE OR REPLACE FUNCTION public.are_users_same_company(user_a uuid, user_b uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p1, profiles p2
    WHERE p1.user_id = user_a AND p2.user_id = user_b
      AND p1.empresa_id = p2.empresa_id
  );
$$;

-- 4. Chat Attachments Policies
-- View: Only if same company or admin
CREATE POLICY "Chat view company isolation"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments' AND (
    is_profile_admin(auth.uid()) OR
    are_users_same_company(owner, auth.uid())
  )
);

-- Insert: Only authenticated
CREATE POLICY "Chat insert auth"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'chat-attachments');

-- Delete/Update: Only owner or admin
CREATE POLICY "Chat modify ownership"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'chat-attachments' AND (
    is_profile_admin(auth.uid()) OR
    owner = auth.uid()
  )
);

-- 5. Maintenance Attachments Policies
-- Path is equipment_id/filename
CREATE POLICY "Maintenance view company isolation"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'maintenance-attachments' AND (
    is_profile_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM equipments e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.empresa_id = get_my_empresa_id()
    )
  )
);

CREATE POLICY "Maintenance insert company isolation"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'maintenance-attachments' AND (
    is_profile_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM equipments e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.empresa_id = get_my_empresa_id()
    )
  )
);

CREATE POLICY "Maintenance modify company isolation"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'maintenance-attachments' AND (
    is_profile_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM equipments e
      WHERE e.id::text = (storage.foldername(name))[1]
        AND e.empresa_id = get_my_empresa_id()
    )
  )
);

-- 6. Quote Attachments Policies
-- Path is quote_id/filename
CREATE POLICY "Quotes view company isolation"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'quote-attachments' AND (
    is_profile_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id::text = (storage.foldername(name))[1]
        AND q.empresa_id = get_my_empresa_id()
    )
  )
);

CREATE POLICY "Quotes insert company isolation"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'quote-attachments' AND (
    is_profile_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id::text = (storage.foldername(name))[1]
        AND q.empresa_id = get_my_empresa_id()
    )
  )
);

CREATE POLICY "Quotes modify company isolation"
ON storage.objects FOR ALL
TO authenticated
USING (
  bucket_id = 'quote-attachments' AND (
    is_profile_admin(auth.uid()) OR
    EXISTS (
      SELECT 1 FROM quotes q
      WHERE q.id::text = (storage.foldername(name))[1]
        AND q.empresa_id = get_my_empresa_id()
    )
  )
);
