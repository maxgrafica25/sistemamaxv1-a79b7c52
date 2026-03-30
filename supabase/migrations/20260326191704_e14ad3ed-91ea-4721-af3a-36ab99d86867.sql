
CREATE OR REPLACE FUNCTION public.is_profile_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_channel_creator(_user_id uuid, _channel_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.channels
    WHERE id = _channel_id AND created_by = _user_id
  )
$$;

DROP POLICY IF EXISTS "Add channel members" ON public.channel_members;

CREATE POLICY "Add channel members" ON public.channel_members
FOR INSERT TO authenticated
WITH CHECK (
  public.is_profile_admin(auth.uid()) 
  OR public.is_channel_creator(auth.uid(), channel_id)
);
