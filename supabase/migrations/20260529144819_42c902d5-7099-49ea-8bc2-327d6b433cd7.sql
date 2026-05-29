-- Drop the existing permissive policy
DROP POLICY IF EXISTS "Authenticated read profiles (same tenant)" ON public.profiles;

-- Create the new more restrictive policy
CREATE POLICY "Profiles are viewable by self or company admins"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR 
  (
    SELECT role = 'admin' 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  ) 
  AND 
  empresa_id = (
    SELECT empresa_id 
    FROM public.profiles 
    WHERE user_id = auth.uid()
  )
);

-- Note: The subqueries on the same table are generally allowed in Postgres RLS 
-- and are optimized by the planner. If recursion issues occur, we would move this
-- to a security definer function.
