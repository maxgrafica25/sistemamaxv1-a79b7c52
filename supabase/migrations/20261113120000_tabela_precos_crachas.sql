-- Crachás PVC (Fargo C50) — preços revistos com o Juliano em 13/11/2026.
-- Custos (planilha do Juliano): ribbon R$ 398/250 = 1,592; cartão PVC R$ 340/500 = 0,68; depreciação R$ 9.500/5.000 = 1,90
-- por impressão. 1 lado = 4,17; 2 lados = 2 impressões (ribbon e depreciação ×2) e 1 cartão = 7,66.
-- Tempos informados pelo Juliano: arte 1 min, impressão 15 s por lado, furo + colocar a cordinha 30 s. Cordinha R$ 1,00.
-- Regra padrão: taxas 22% + lucro 33% + preparação do pedido 2,5 min. Revenda (outras gráficas/agências): lucro 20–25%.
-- Itens novos (com cordinha e revenda) ainda sem SKU: criar no Tiny e informar o SKU na tela.
DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
  cat uuid;
  tab uuid;
  n int;
BEGIN
  IF emp IS NULL THEN RETURN; END IF;
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Crachás' LIMIT 1;
  IF cat IS NULL THEN RETURN; END IF;

  -- Crachá 1 lado (SKUs do Tiny 598 / 5982 / 5983 / 5984)
  SELECT id INTO tab FROM public.price_tables WHERE category_id = cat AND name = 'Impressão Crachá PVC 1 Lado' LIMIT 1;
  IF tab IS NOT NULL THEN
    UPDATE public.price_tables SET calc_type = 'manual', material_cost = 4.17, extra_cost = 0, minutes_per_unit = 1.25,
      notes = 'Ribbon 1,59 + cartão 0,68 + depreciação 1,90. Arte 1 min + impressão 15 s.'
    WHERE id = tab;
    DELETE FROM public.price_table_tiers WHERE price_table_id = tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 18.60, '598', 0), (emp, tab, 11, 20, 12.80, '5982', 1),
      (emp, tab, 21, 50, 11.90, '5983', 2), (emp, tab, 51, NULL, 11.70, '5984', 3);
  END IF;

  -- Crachá 2 lados (SKUs 599 / 5992 / 5993 / 5994); faixa 2 corrigida (era "de 6 a 20")
  SELECT id INTO tab FROM public.price_tables WHERE category_id = cat AND name = 'Impressão Crachá PVC 2 Lados' LIMIT 1;
  IF tab IS NOT NULL THEN
    UPDATE public.price_tables SET calc_type = 'manual', material_cost = 7.66, extra_cost = 0, minutes_per_unit = 1.5,
      notes = '2 impressões (ribbon 3,18 + depreciação 3,80) + 1 cartão 0,68. Arte 1 min + impressão 2 × 15 s.'
    WHERE id = tab;
    DELETE FROM public.price_table_tiers WHERE price_table_id = tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 25.90, '599', 0), (emp, tab, 11, 20, 21.90, '5992', 1),
      (emp, tab, 21, 50, 19.90, '5993', 2), (emp, tab, 51, NULL, 19.90, '5994', 3);
  END IF;

  SELECT COALESCE(MAX(sort_order), 0) INTO n FROM public.price_tables WHERE category_id = cat;

  -- Itens novos (só cria se ainda não existir)
  IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE category_id = cat AND name = 'Crachá PVC 1 Lado + Cordinha') THEN
    INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
    VALUES (emp, cat, 'Crachá PVC 1 Lado + Cordinha', 'manual', 'A4', 1, 5.17, 0, 1.75,
      'Crachá 1 lado (4,17) + cordinha 1,00. Arte 1 min + impressão 15 s + furo e cordinha 30 s.', n + 1) RETURNING id INTO tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 22.10, NULL, 0), (emp, tab, 11, 20, 16.30, NULL, 1), (emp, tab, 21, 50, 15.10, NULL, 2), (emp, tab, 51, NULL, 14.90, NULL, 3);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE category_id = cat AND name = 'Crachá PVC 2 Lados + Cordinha') THEN
    INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
    VALUES (emp, cat, 'Crachá PVC 2 Lados + Cordinha', 'manual', 'A4', 2, 8.66, 0, 2.0,
      'Crachá 2 lados (7,66) + cordinha 1,00. Arte 1 min + impressão 2 × 15 s + furo e cordinha 30 s.', n + 2) RETURNING id INTO tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 29.40, NULL, 0), (emp, tab, 11, 20, 25.40, NULL, 1), (emp, tab, 21, NULL, 23.10, NULL, 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE category_id = cat AND name = 'Crachá PVC 1 Lado - Revenda') THEN
    INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
    VALUES (emp, cat, 'Crachá PVC 1 Lado - Revenda', 'manual', 'A4', 1, 4.17, 0, 1.25,
      'Preço para outras gráficas/agências revenderem (lucro 20–25%).', n + 3) RETURNING id INTO tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 10.90, NULL, 0), (emp, tab, 11, NULL, 9.50, NULL, 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE category_id = cat AND name = 'Crachá PVC 2 Lados - Revenda') THEN
    INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
    VALUES (emp, cat, 'Crachá PVC 2 Lados - Revenda', 'manual', 'A4', 2, 7.66, 0, 1.5,
      'Preço para outras gráficas/agências revenderem (lucro 20–25%).', n + 4) RETURNING id INTO tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 17.90, NULL, 0), (emp, tab, 11, NULL, 16.50, NULL, 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE category_id = cat AND name = 'Crachá PVC 1 Lado + Cordinha - Revenda') THEN
    INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
    VALUES (emp, cat, 'Crachá PVC 1 Lado + Cordinha - Revenda', 'manual', 'A4', 1, 5.17, 0, 1.75,
      'Revenda: crachá + cordinha (cordinha a R$ 2,50). Lucro 20–25%.', n + 5) RETURNING id INTO tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 13.40, NULL, 0), (emp, tab, 11, NULL, 12.00, NULL, 1);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.price_tables WHERE category_id = cat AND name = 'Crachá PVC 2 Lados + Cordinha - Revenda') THEN
    INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, notes, sort_order)
    VALUES (emp, cat, 'Crachá PVC 2 Lados + Cordinha - Revenda', 'manual', 'A4', 2, 8.66, 0, 2.0,
      'Revenda: crachá + cordinha (cordinha a R$ 2,50). Lucro 20–25%.', n + 6) RETURNING id INTO tab;
    INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES
      (emp, tab, 1, 10, 20.40, NULL, 0), (emp, tab, 11, NULL, 19.00, NULL, 1);
  END IF;
END $$;
