-- Placas: custo = chapa + adesivo impresso (Ritrama, R$ 14,19/m² com sobra) — a impressão
-- (tinta/máquina) já vem da linha de impressão. Aplicação + corte e laminação por tempo
-- (R$ 0,81/min) + material. Preços de venda mantidos (só muda a divisão custo/lucro).
-- Tempos: 11 placas PS 2 mm 30×42 cm adesivadas e cortadas em 50 min (planilha da gestão).
DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
BEGIN
  IF emp IS NULL THEN RETURN; END IF;

  -- Chapas (+ adesivo por baixo). Tabela Bluebird set/2025 e notas até out/2026, +10% de sobra.
  UPDATE public.cv_calc_midias m SET
    lucro_mt2 = m.custo_mt2 + m.lucro_mt2 - v.custo,
    custo_mt2 = v.custo
  FROM (VALUES
    ('Placa PVC 1mm', 25.08 + 14.19),   -- PS 1 mm ~R$ 45,60/chapa 2×1
    ('Placa PVC 2mm', 23.99 + 14.19),   -- R$ 65/chapa 1,22×2,44
    ('Placa PVC 3mm', 32.12 + 14.19),   -- R$ 85–87/chapa 1,22×2,44
    ('Placa PS 2mm',  41.80 + 14.19),   -- R$ 76/chapa 2×1
    ('Placa PS 3mm',  66.00 + 14.19)    -- R$ 120/chapa 2×1
  ) AS v(nome, custo)
  WHERE m.nome = v.nome AND m.empresa_id = emp;

  -- Aplicação do adesivo + corte: 5 min de preparo + 2 min por metro de contorno + 8 min por m².
  UPDATE public.cv_calc_acabamentos SET
    nome = 'Aplicação do adesivo + corte (até 3mm)',
    custo_fixo = 4.07,  lucro_fixo = 10.93,
    custo_mt2 = 6.52,   lucro_mt2 = 27.48,
    custo_perimetro = 1.63, lucro_perimetro = 0.87
  WHERE empresa_id = emp AND nome = 'Corte até 3mm';

  -- Laminação = adesivo transparente (R$ 17,90/m + 10% sobra) + 5 min/m².
  UPDATE public.cv_calc_acabamentos a SET
    lucro_mt2 = a.custo_mt2 + a.lucro_mt2 - 23.76,
    custo_mt2 = 23.76
  WHERE a.empresa_id = emp AND a.nome IN ('Laminação Vinil (Chapa)', 'Laminação (Adesivo)', 'Laminação (Lona)');
END $$;
