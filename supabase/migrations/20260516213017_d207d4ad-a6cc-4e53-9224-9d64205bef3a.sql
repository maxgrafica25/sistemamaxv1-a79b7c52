-- 1. Renomear tabelas antigas para sufixo legacy_ (preservando dados como backup)
ALTER TABLE IF EXISTS public.cv_materials RENAME TO legacy_cv_materials;
ALTER TABLE IF EXISTS public.cv_printers  RENAME TO legacy_cv_printers;
ALTER TABLE IF EXISTS public.cv_finishes  RENAME TO legacy_cv_finishes;

-- 2. Adicionar colunas em cv_quote_items para refletir novo modelo
ALTER TABLE public.cv_quote_items
  ADD COLUMN IF NOT EXISTS acabamento_id uuid,
  ADD COLUMN IF NOT EXISTS acabamento_nome text,
  ADD COLUMN IF NOT EXISTS perimetro_m numeric NOT NULL DEFAULT 0;

-- 3. Unique para evitar mídias duplicadas (mesmo nome + mesmo tipo)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'cv_calc_midias_nome_tipo_unique'
  ) THEN
    CREATE UNIQUE INDEX cv_calc_midias_nome_tipo_unique
      ON public.cv_calc_midias (lower(nome), tipo_midia);
  END IF;
END $$;