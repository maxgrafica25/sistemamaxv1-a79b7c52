-- Rollback do item 3
BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts_receivable;
ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts_receivable_installments;

COMMIT;
