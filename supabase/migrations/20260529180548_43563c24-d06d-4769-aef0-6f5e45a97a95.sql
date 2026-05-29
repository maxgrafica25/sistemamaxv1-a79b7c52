-- Add to whitelist with mandatory reason
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tenant_enforcement_whitelist') THEN
        INSERT INTO public.tenant_enforcement_whitelist (table_name, reason)
        VALUES ('auth_attempts', 'Global security table for rate limiting')
        ON CONFLICT (table_name) DO UPDATE SET reason = EXCLUDED.reason;
    END IF;
END $$;

-- Create the table to track attempts
CREATE TABLE IF NOT EXISTS public.auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    identifier TEXT NOT NULL,
    successful BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time ON public.auth_attempts (ip_address, created_at DESC);

-- Function to check if an IP is blocked
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recent_failures INTEGER;
    v_last_success_time TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT MAX(created_at) INTO v_last_success_time
    FROM public.auth_attempts
    WHERE ip_address = p_ip_address AND successful = true;

    SELECT COUNT(*) INTO v_recent_failures
    FROM public.auth_attempts
    WHERE ip_address = p_ip_address 
      AND successful = false
      AND created_at > COALESCE(v_last_success_time, now() - INTERVAL '15 minutes')
      AND created_at > now() - INTERVAL '15 minutes';

    RETURN v_recent_failures >= 5;
END;
$$;

-- Drop first to avoid parameter name conflict
DROP FUNCTION IF EXISTS public.record_auth_attempt(TEXT, TEXT, BOOLEAN);

-- Function to record an attempt
CREATE OR REPLACE FUNCTION public.record_auth_attempt(
    p_ip_address TEXT,
    p_identifier TEXT,
    p_successful BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.auth_attempts (ip_address, identifier, successful)
    VALUES (p_ip_address, p_identifier, p_successful);
END;
$$;

-- Grant permissions
GRANT ALL ON public.auth_attempts TO service_role;
GRANT SELECT ON public.auth_attempts TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(TEXT, TEXT, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(TEXT, TEXT, BOOLEAN) TO authenticated;
