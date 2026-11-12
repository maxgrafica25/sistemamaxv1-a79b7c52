-- Leituras, trocas de toner e manutenções lançadas pela Júlia (WhatsApp) ficam marcadas com origem = 'julia'.
-- O que a equipe lança na tela continua 'sistema'; a Júlia lê só esses para não duplicar o que ela mesma gravou.
ALTER TABLE public.printer_readings
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'sistema';
ALTER TABLE public.equipment_maintenances
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'sistema';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'printer_readings_origem_check') THEN
    ALTER TABLE public.printer_readings
      ADD CONSTRAINT printer_readings_origem_check CHECK (origem IN ('sistema', 'julia'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_maintenances_origem_check') THEN
    ALTER TABLE public.equipment_maintenances
      ADD CONSTRAINT equipment_maintenances_origem_check CHECK (origem IN ('sistema', 'julia'));
  END IF;
END $$;

-- A Júlia busca o que mudou desde a última consulta.
CREATE INDEX IF NOT EXISTS printer_readings_origem_created_idx ON public.printer_readings (origem, created_at);
CREATE INDEX IF NOT EXISTS equipment_maintenances_origem_created_idx ON public.equipment_maintenances (origem, created_at);
