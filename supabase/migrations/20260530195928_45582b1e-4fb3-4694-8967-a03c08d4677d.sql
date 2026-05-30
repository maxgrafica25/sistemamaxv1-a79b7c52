-- Drop old function
DROP FUNCTION IF EXISTS public.is_ip_blocked(TEXT);

-- New function checking both IP and Identifier
CREATE OR REPLACE FUNCTION public.is_auth_blocked(p_ip_address TEXT, p_identifier TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ip_failures INTEGER;
    v_id_failures INTEGER;
    v_last_success_time_ip TIMESTAMP WITH TIME ZONE;
    v_last_success_time_id TIMESTAMP WITH TIME ZONE;
BEGIN
    -- failures for this IP since last success
    SELECT MAX(created_at) INTO v_last_success_time_ip
    FROM public.auth_attempts
    WHERE ip_address = p_ip_address AND successful = true;

    SELECT COUNT(*) INTO v_ip_failures
    FROM public.auth_attempts
    WHERE ip_address = p_ip_address 
      AND successful = false
      AND created_at > COALESCE(v_last_success_time_ip, now() - INTERVAL '15 minutes')
      AND created_at > now() - INTERVAL '15 minutes';

    -- failures for this Identifier across any IP since last success
    SELECT MAX(created_at) INTO v_last_success_time_id
    FROM public.auth_attempts
    WHERE identifier = p_identifier AND successful = true;

    SELECT COUNT(*) INTO v_id_failures
    FROM public.auth_attempts
    WHERE identifier = p_identifier
      AND successful = false
      AND created_at > COALESCE(v_last_success_time_id, now() - INTERVAL '15 minutes')
      AND created_at > now() - INTERVAL '15 minutes';

    RETURN v_ip_failures >= 5 OR v_id_failures >= 10;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.is_auth_blocked(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_auth_blocked(TEXT, TEXT) TO authenticated;