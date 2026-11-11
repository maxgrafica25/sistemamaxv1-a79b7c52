-- Tabela de Preços: Encadernação Wire-O e Corte na Guilhotina (04/11/2026).
-- Wire-O: preços e faixas do Tiny (SKUs 108, 109, 548; faixas Até 30 / 31 a 100 / +de 100), que não
-- entraram na carga inicial porque não estavam no formato "(TPn ...)".
-- Custo do wire-o pela cotação da Letícia (04/11/2026): 5/8 prata R$ 1,10 e 7/8 prata R$ 1,75 por peça de
-- 14 anéis passo 2x1 → R$ 0,0786 e R$ 0,125 por anel. A4 = 23 anéis no 2x1 e 34 no 3x1; A3 = 33 e 49.
-- 2x1 até 200 folhas = 7/8. 3x1 (até 60 e até 120) ainda sem cotação: estimado com o preço por anel do 5/8.
-- Capas (acetato/contracapa) não incluídas. Tempos e custos estimados: atualizar quando medir.
-- Guilhotina: preparação por pedido (R$ 10, mesmo preço do Tiny, SKU 62) + por folha cortada.
DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
  cat uuid;
  tab uuid;
  r record;
BEGIN
  IF emp IS NULL THEN RETURN; END IF;

  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Encadernação';
  IF cat IS NOT NULL THEN
    FOR r IN SELECT * FROM (VALUES
      ('Encadernação Wire-O 3x1 Até 60 Folhas A4', 'A4', 2.67, 3.0, 6.0, 5.5, 4.6, '108', 10),
      ('Encadernação Wire-O 3x1 Até 120 Folhas A4', 'A4', 2.67, 4.0, 7.0, 6.4, 5.4, '109', 11),
      ('Encadernação Wire-O 2x1 Até 200 Folhas A4', 'A4', 2.88, 6.0, 9.0, 8.2, 6.8, '548', 12),
      ('Encadernação Wire-O 3x1 Até 60 Folhas A3', 'A3', 3.85, 4.0, 9.0, 8.2, 6.8, '108', 13),
      ('Encadernação Wire-O 3x1 Até 120 Folhas A3', 'A3', 3.85, 5.0, 10.0, 9.1, 9.0, '109', 14),
      ('Encadernação Wire-O 2x1 Até 200 Folhas A3', 'A3', 4.13, 7.0, 12.0, 10.9, 9.0, '548', 15)
    ) AS v(nome, tamanho, material, minutos, p1, p2, p3, sku, ordem) LOOP
      CONTINUE WHEN EXISTS (SELECT 1 FROM public.price_tables WHERE empresa_id = emp AND name = r.nome);
      INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
      VALUES (emp, cat, r.nome, 'manual', r.tamanho, 1, r.material, 0, r.minutos,
              'Wire-o: cotação Letícia 04/11/2026 (3x1 estimado pelo 5/8). Capas não incluídas. Tempo ESTIMADO.', r.ordem)
      RETURNING id INTO tab;
      INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
        (emp, tab, 1, 30, r.p1, r.sku, 0), (emp, tab, 31, 100, r.p2, r.sku, 1), (emp, tab, 101, NULL, r.p3, r.sku, 2);
    END LOOP;
  END IF;

  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Outros serviços';
  IF cat IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE empresa_id = emp AND name = 'Corte na Guilhotina - Preparação') THEN
      INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
      VALUES (emp, cat, 'Corte na Guilhotina - Preparação', 'manual', 'A4', 1, 0, 0, 5,
              'Uma vez por pedido (ajustar a guilhotina, alinhar). Tempo ESTIMADO 04/11/2026.', 20)
      RETURNING id INTO tab;
      INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order)
      VALUES (emp, tab, 1, NULL, 10.0, '62', 0);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE empresa_id = emp AND name = 'Corte na Guilhotina - por Folha') THEN
      INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
      VALUES (emp, cat, 'Corte na Guilhotina - por Folha', 'manual', 'A4', 1, 0, 0, 0.1,
              'Por folha A4/A3 cortada (cartão, flyer, tag). Tempo ESTIMADO 04/11/2026: 0,1 min/folha.', 21)
      RETURNING id INTO tab;
      INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order)
      VALUES (emp, tab, 1, NULL, 0.2, NULL, 0);
    END IF;
  END IF;
END $$;
