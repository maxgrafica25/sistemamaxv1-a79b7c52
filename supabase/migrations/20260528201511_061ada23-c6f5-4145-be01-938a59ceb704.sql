-- Add login_attempts to tenant enforcement whitelist with reason
INSERT INTO public.tenant_enforcement_whitelist (table_name, reason) 
VALUES ('login_attempts', 'Global login attempt tracking for brute force protection');

-- Create login_attempts table
CREATE TABLE public.login_attempts (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT,
    ip_address TEXT,
    attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    success BOOLEAN NOT NULL DEFAULT false
);

-- Indices for performance
CREATE INDEX idx_login_attempts_email_time ON public.login_attempts (email, attempted_at) WHERE success = false;
CREATE INDEX idx_login_attempts_ip_time ON public.login_attempts (ip_address, attempted_at) WHERE success = false;

-- Disable public access, allow service_role only
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.login_attempts TO service_role;
