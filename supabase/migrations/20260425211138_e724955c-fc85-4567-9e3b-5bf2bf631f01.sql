-- Habilita realtime na tabela de alertas para que o "Foco Preditivo" da Júlia
-- atualize a Command Palette assim que um alerta crítico é resolvido por outro usuário.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'reading_alerts_sent'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_alerts_sent';
  END IF;
END $$;

ALTER TABLE public.reading_alerts_sent REPLICA IDENTITY FULL;