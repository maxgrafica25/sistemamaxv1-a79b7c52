ALTER TABLE public.quote_presets
  ADD COLUMN IF NOT EXISTS papel_default_nome     text,
  ADD COLUMN IF NOT EXISTS papel_default_grammage text,
  ADD COLUMN IF NOT EXISTS side_default           text,
  ADD COLUMN IF NOT EXISTS preselect_acabamentos  boolean NOT NULL DEFAULT false;

INSERT INTO public.quote_presets (
  nome, icone, modulo, form_tipo, ordem, ativo,
  quantidade_padrao, papel_inclui, papel_exclui, acabamentos_sugeridos,
  papel_default_nome, papel_default_grammage, side_default, preselect_acabamentos
)
SELECT
  'Tags', 'Tag', 'impressao', 'print', 55, true,
  100, ARRAY['couchê','couche']::text[], ARRAY[]::text[],
  ARRAY[(SELECT id::text FROM public.finishings_price_items WHERE name = 'Recorte Folhas Papéis Especiais' LIMIT 1)],
  'couchê', '300', 'F/V', true
WHERE NOT EXISTS (
  SELECT 1 FROM public.quote_presets WHERE lower(nome) = 'tags' AND modulo = 'impressao'
);