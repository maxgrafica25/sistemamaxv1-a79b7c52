-- Remove all existing policies from public.profiles
DO $$ 
DECLARE 
    pol RECORD;
BEGIN 
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- Recreate functions with SECURITY DEFINER and fixed search_path to avoid recursion and security issues
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$ 
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() AND role = 'admin'
  ); 
$$;

CREATE OR REPLACE FUNCTION public.get_my_empresa_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$ 
  SELECT empresa_id FROM public.profiles 
  WHERE user_id = auth.uid() 
  LIMIT 1; 
$$;

-- Create new, simple policies that use the functions
CREATE POLICY "select_own_profile" ON public.profiles
FOR SELECT USING (
  user_id = auth.uid() 
  OR (public.is_admin() AND empresa_id = public.get_my_empresa_id())
);

CREATE POLICY "update_own_profile" ON public.profiles
FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "insert_own_profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ensure permissions are correctly set
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
