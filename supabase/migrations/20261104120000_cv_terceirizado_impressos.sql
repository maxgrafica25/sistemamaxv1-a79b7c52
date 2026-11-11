-- Tabela de terceirizados (decidida com o Juliano em 04/11/2026). Venda sem nota, no Pix/dinheiro.
-- Preço por m² da peça, impressão já inclusa (não soma a impressão da Signstar à parte).
-- Custos: lona 9,46 + frete 0,63; adesivo 14,19; perfurado 17,49; impressão Signstar 12,20;
-- recorte eletrônico + descasque 15,00/m² (valor da planilha antiga).
ALTER TABLE public.cv_calc_midias ADD COLUMN IF NOT EXISTS sem_impressao_separada boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
BEGIN
  IF emp IS NULL THEN RETURN; END IF;

  -- Lona sem impressão: nunca somar impressão.
  UPDATE public.cv_calc_midias SET sem_impressao_separada = true
  WHERE empresa_id = emp AND nome = 'Lona Sem Impressão (Terceirizado)';

  INSERT INTO public.cv_calc_midias (empresa_id, nome, tipo_midia, custo_mt2, lucro_mt2, custo_fixo, lucro_fixo, sem_impressao_separada, sort_order)
  SELECT emp, v.nome, v.tipo, v.custo, v.preco - v.custo, 0, 0, true, v.ordem
  FROM (VALUES
    ('Lona Impressa (Terceirizado)',                         'lona',    22.30, 45.00, 51),
    ('Adesivo Impresso (Terceirizado)',                      'adesivo', 26.40, 45.00, 52),
    ('Adesivo Perfurado Impresso (Terceirizado)',            'adesivo', 29.70, 60.00, 53),
    ('Adesivo Impresso + Recorte Eletrônico (Terceirizado)', 'adesivo', 41.40, 60.00, 54)
  ) AS v(nome, tipo, custo, preco, ordem)
  WHERE NOT EXISTS (SELECT 1 FROM public.cv_calc_midias x WHERE x.nome = v.nome AND x.empresa_id = emp);
END $$;
