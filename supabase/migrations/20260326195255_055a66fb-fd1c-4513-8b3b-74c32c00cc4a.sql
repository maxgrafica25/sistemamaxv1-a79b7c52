DROP POLICY IF EXISTS "Remove channel members" ON public.channel_members;
CREATE POLICY "Remove channel members" ON public.channel_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid()
  OR is_profile_admin(auth.uid())
  OR is_channel_creator(auth.uid(), channel_id)
);