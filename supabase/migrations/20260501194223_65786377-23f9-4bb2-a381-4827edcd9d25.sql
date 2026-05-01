-- Permitir INSERT em audit_logs por usuários anônimos APENAS para eventos de recuperação de senha
DROP POLICY IF EXISTS "Anon can insert password reset audit" ON public.audit_logs;

CREATE POLICY "Anon can insert password reset audit"
ON public.audit_logs
FOR INSERT
TO anon
WITH CHECK (
  entity_type = 'auth'
  AND action LIKE 'password_reset_%'
);