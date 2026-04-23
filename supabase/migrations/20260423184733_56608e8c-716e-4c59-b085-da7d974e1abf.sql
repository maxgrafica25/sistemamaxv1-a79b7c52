-- Cancela a duplicata "Treino" criada na sessão 15:34 onde a Júlia falhou no remarcar.
-- O delete original do Treino 11h15 não passou (UUID inventado bloqueado pelo guard),
-- mas o create do novo Treino 11h30 passou — gerando duplicata.
UPDATE public.reminders
   SET cancelled_at = now(),
       cancelled_reason = 'duplicate_from_failed_reschedule',
       updated_at = now()
 WHERE id = '53cf6d83-4438-4f45-9213-5c87c74e6aa3'
   AND cancelled_at IS NULL;