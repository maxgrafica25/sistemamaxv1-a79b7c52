-- Comunicação visual: custos reais tirados das notas de compra (out/2025–out/2026),
-- mantendo os preços de venda (custo + lucro) da planilha da gestão.
-- Mídias com 10% de sobra de rolo. Impressão Signstar ≈ R$ 12,20/m² (tinta + manutenção + depreciação).
DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
BEGIN
  IF emp IS NULL THEN RETURN; END IF;

  -- Mídias: novo custo real; lucro = preço antigo − custo (nunca negativo).
  UPDATE public.cv_calc_midias m SET
    lucro_mt2 = GREATEST(0, m.custo_mt2 + m.lucro_mt2 - v.custo),
    custo_mt2 = v.custo
  FROM (VALUES
    ('Adesivo Brilho', 14.19),
    ('Adesivo Fosco', 14.19),
    ('Adesivo Brilho Bloqueado', 14.30),
    ('Adesivo Fosco Bloqueado', 14.30),
    ('Adesivo Perfurado', 17.49),
    ('Adesivo Transparente', 19.69),
    ('Lona Brilho', 9.46),
    ('Lona Fosca', 9.79),
    ('Placa PVC 3mm', 32.12)
  ) AS v(nome, custo)
  WHERE m.nome = v.nome AND m.empresa_id = emp;

  -- Placas de PS (chapas grandes): custo próprio, preço = PVC equivalente + R$ 40/m².
  INSERT INTO public.cv_calc_midias (empresa_id, nome, tipo_midia, custo_mt2, lucro_mt2, custo_fixo, lucro_fixo, sort_order)
  SELECT emp, v.nome, 'chapa', v.custo, v.lucro, 0, 10, v.ordem
  FROM (VALUES
    ('Placa PS 2mm', 41.80, 65.20, 100),
    ('Placa PS 3mm', 66.00, 62.00, 101)
  ) AS v(nome, custo, lucro, ordem)
  WHERE NOT EXISTS (SELECT 1 FROM public.cv_calc_midias x WHERE x.nome = v.nome AND x.empresa_id = emp);

  -- Impressão na Signstar: custo real, mesmo preço por m²; também serve para placas (como na planilha).
  UPDATE public.cv_calc_impressoes i SET
    lucro_mt2 = i.custo_mt2 + i.lucro_mt2 - 12.20,
    custo_mt2 = 12.20,
    tipos_midia_compativeis = ARRAY['lona','adesivo','chapa']
  WHERE i.empresa_id = emp AND i.nome IN ('Impressão Solvente Baixa Resolução', 'Impressão Solvente Alta Resolução');

  -- Acabamentos de placa que estavam na planilha e faltavam no sistema.
  INSERT INTO public.cv_calc_acabamentos (empresa_id, nome, familia, tipos_midia_compativeis,
    custo_fixo, lucro_fixo, custo_mt2, lucro_mt2, custo_perimetro, lucro_perimetro, custo_unidade, lucro_unidade, sort_order)
  SELECT emp, v.nome, v.familia, ARRAY['chapa'], v.cf, v.lf, v.cm, v.lm, v.cp, v.lp, v.cu, v.lu, v.ordem
  FROM (VALUES
    ('Corte até 3mm',                'outro',     5, 10, 17, 17, 1,   1.5, 0,   0,    20),
    ('Dupla Face',                   'outro',     0,  0,  0,  0, 2,   1.5, 0,   0,    21),
    ('Ilhós (Chapa)',                'ilhos',     0,  0,  0,  0, 0.6, 0.6, 0,   0,    22),
    ('Laminação Vinil (Chapa)',      'laminacao', 0,  0, 30, 30, 0,   0,   0,   0,    23),
    ('Corte Ímã Automotivo',         'outro',     5, 10, 12, 12, 0.5, 2,   0,   0,    24),
    ('Recorte Especial (Eletrônico)','recorte',  10,  0, 35, 35, 0,   0,   0,   0,    25),
    ('Recorte Reto',                 'outro',    10,  0,  0,  0, 0.1, 0.1, 0,   0,    26),
    ('Laminação Bopp (Chapa)',       'laminacao',12,  0, 15, 15, 0,   0,   0,   0,    27),
    ('Display',                      'outro',     5, 10, 17, 17, 1,   1.5, 1.8, 0.95, 28)
  ) AS v(nome, familia, cf, lf, cm, lm, cp, lp, cu, lu, ordem)
  WHERE NOT EXISTS (SELECT 1 FROM public.cv_calc_acabamentos x WHERE x.nome = v.nome AND x.empresa_id = emp);
END $$;
