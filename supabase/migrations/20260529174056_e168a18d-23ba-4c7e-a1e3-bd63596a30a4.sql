-- Create in a separate schema to bypass public schema tenant triggers
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS security.auth_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address INET NOT NULL,
    attempted_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    is_success BOOLEAN DEFAULT false,
    email TEXT
);

CREATE INDEX IF NOT EXISTS idx_auth_attempts_ip_time ON security.auth_attempts (ip_address, attempted_at DESC);

-- Function to check if an IP is currently blocked (5 failures in last 15 mins)
CREATE OR REPLACE FUNCTION public.check_auth_rate_limit(p_ip_address TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public
AS $$
DECLARE
    failure_count INTEGER;
BEGIN
    SELECT count(*)
    INTO failure_count
    FROM security.auth_attempts
    WHERE ip_address = p_ip_address::INET
      AND is_success = false
      AND attempted_at > now() - interval '15 minutes';

    RETURN failure_count < 5;
END;
$$;

-- Function to record an attempt
CREATE OR REPLACE FUNCTION public.record_auth_attempt(p_ip_address TEXT, p_email TEXT, p_is_success BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = security, public
AS $$
BEGIN
    INSERT INTO security.auth_attempts (ip_address, email, is_success)
    VALUES (p_ip_address::INET, p_email, p_is_success);
    
    DELETE FROM security.auth_attempts WHERE attempted_at < now() - interval '24 hours';
END;
$$;

GRANT ALL ON SCHEMA security TO service_role;
GRANT SELECT, INSERT, DELETE ON security.auth_attempts TO service_role;
GRANT EXECUTE ON FUNCTION public.check_auth_rate_limit(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_auth_attempt(TEXT, TEXT, BOOLEAN) TO service_role;
