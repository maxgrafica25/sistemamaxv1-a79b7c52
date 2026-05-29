-- Drop the existing update policy
DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;

-- Create a more granular update policy with column-level restrictions
CREATE POLICY "Users can update their own profile with restrictions"
ON public.profiles
FOR UPDATE
USING (
  -- Users can update their own profile OR admins/owners can update profiles in their company
  auth.uid() = user_id OR 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = auth.uid() 
    AND p.role IN ('owner', 'admin') 
    AND p.empresa_id = public.profiles.empresa_id
  )
)
WITH CHECK (
  -- If it's the user updating their own profile
  CASE 
    WHEN auth.uid() = user_id THEN
      -- Check if they are NOT an admin/owner
      CASE 
        WHEN NOT EXISTS (
          SELECT 1 FROM public.profiles p 
          WHERE p.user_id = auth.uid() 
          AND p.role IN ('owner', 'admin')
        ) THEN
          -- Regular users: role, empresa_id, and is_active must NOT change
          (role = (SELECT role FROM public.profiles WHERE user_id = auth.uid())) AND
          (empresa_id = (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())) AND
          (is_active = (SELECT is_active FROM public.profiles WHERE user_id = auth.uid()))
        ELSE
          -- Admins/owners can change these fields
          TRUE
      END
    ELSE
      -- If it's an admin updating someone else's profile (checked in USING)
      TRUE
  END
);