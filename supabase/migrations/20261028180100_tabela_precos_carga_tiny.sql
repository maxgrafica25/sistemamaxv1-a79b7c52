-- Carga inicial da Tabela de Preços: 185 tabelas com faixa (TP1…TPn) da exportação de produtos do Tiny
-- de 28/10/2026 (docs/tiny_produtos_2026-10-28.csv). Preços e SKUs = Tiny. Custos: papel por folha
-- (Kgepel fev/2026 para sulfite 75 g e couché; demais da cotação Maxipel jan/2024), máquina pelos
-- consumíveis de Equipamentos, recorte pela plotter Ultrajet Z3 e serviços pela planilha "Serviços de
-- Balcão" (material + minutos). Personalizados ficam sem custo até a gestão informar.
-- Erro de cadastro do Tiny corrigido aqui: Color Laser A4 Couchê 115g TP3 = 101 a 300 un.
DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
  cat uuid;
  tab uuid;
BEGIN
  IF emp IS NULL OR EXISTS (SELECT 1 FROM public.price_table_categories WHERE empresa_id = emp) THEN RETURN; END IF;

  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Laser P&B', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', '[{"min_qty":1,"max_qty":50},{"min_qty":51,"max_qty":300},{"min_qty":301,"max_qty":1000},{"min_qty":1001,"max_qty":null}]'::jsonb, 0);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Laser Colorida', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', '[{"min_qty":1,"max_qty":20},{"min_qty":21,"max_qty":100},{"min_qty":101,"max_qty":300},{"min_qty":301,"max_qty":null}]'::jsonb, 1);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Jato de tinta P&B', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', '[{"min_qty":1,"max_qty":50},{"min_qty":51,"max_qty":300},{"min_qty":301,"max_qty":1000},{"min_qty":1001,"max_qty":null}]'::jsonb, 2);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Jato de tinta Colorida', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', '[{"min_qty":1,"max_qty":50},{"min_qty":51,"max_qty":300},{"min_qty":301,"max_qty":1000},{"min_qty":1001,"max_qty":null}]'::jsonb, 3);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Envelopes', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":20},{"min_qty":21,"max_qty":50},{"min_qty":51,"max_qty":null}]'::jsonb, 4);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Impressão + Recorte', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', '[{"min_qty":1,"max_qty":20},{"min_qty":21,"max_qty":100},{"min_qty":101,"max_qty":300},{"min_qty":301,"max_qty":null}]'::jsonb, 5);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Recorte eletrônico', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":20},{"min_qty":21,"max_qty":100},{"min_qty":101,"max_qty":300},{"min_qty":301,"max_qty":null}]'::jsonb, 6);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Crachás', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":10},{"min_qty":11,"max_qty":20},{"min_qty":21,"max_qty":50},{"min_qty":51,"max_qty":null}]'::jsonb, 7);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Impressões', 'Impressões especiais', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":10},{"min_qty":11,"max_qty":20},{"min_qty":21,"max_qty":null}]'::jsonb, 8);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Serviços de balcão', 'Encadernação', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":20},{"min_qty":21,"max_qty":50},{"min_qty":51,"max_qty":null}]'::jsonb, 9);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Serviços de balcão', 'Plastificação', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":20},{"min_qty":21,"max_qty":50},{"min_qty":51,"max_qty":null}]'::jsonb, 10);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Serviços de balcão', 'Laminação', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":20},{"min_qty":21,"max_qty":50},{"min_qty":51,"max_qty":100},{"min_qty":101,"max_qty":null}]'::jsonb, 11);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Serviços de balcão', 'Digitalização', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":20},{"min_qty":21,"max_qty":50},{"min_qty":51,"max_qty":null}]'::jsonb, 12);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Serviços de balcão', 'Outros serviços', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":20},{"min_qty":21,"max_qty":null}]'::jsonb, 13);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Personalizados', 'Canecas, copos e garrafas', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":1},{"min_qty":2,"max_qty":5},{"min_qty":6,"max_qty":20},{"min_qty":21,"max_qty":null}]'::jsonb, 14);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Personalizados', 'Têxteis e almofadas', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":10},{"min_qty":11,"max_qty":null}]'::jsonb, 15);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Personalizados', 'Mouse pads', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":50},{"min_qty":51,"max_qty":500},{"min_qty":501,"max_qty":null}]'::jsonb, 16);
  INSERT INTO public.price_table_categories (empresa_id, group_name, name, calc_type, equipment_id, color_mode, default_tiers, sort_order)
  VALUES (emp, 'Personalizados', 'Brindes e outros', 'manual', NULL, NULL, '[{"min_qty":1,"max_qty":5},{"min_qty":6,"max_qty":20},{"min_qty":21,"max_qty":50},{"min_qty":51,"max_qty":null}]'::jsonb, 17);

  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Recorte eletrônico';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Recorte Especial A4 em Papel Kraft', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.6, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.0, '6247', 0), (emp, tab, 21, 100, 3.0, '6248', 1), (emp, tab, 101, 300, 2.6, '6249', 2), (emp, tab, 301, NULL, 2.4, '6250', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Canecas, copos e garrafas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Squeeze Alumínio Prata com Tampa Bola - 600ml', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 100.0, '5479', 0), (emp, tab, 6, 50, 65.0, '5480', 1), (emp, tab, 51, NULL, 60.0, '5481', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 210g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.115, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.0, '266', 0), (emp, tab, 21, 100, 3.0, '2662', 1), (emp, tab, 101, 300, 2.5, '2663', 2), (emp, tab, 301, NULL, 2.0, '2664', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 210g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.115, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.2, '316', 0), (emp, tab, 21, 100, 5.4, '3162', 1), (emp, tab, 101, 300, 4.5, '3163', 2), (emp, tab, 301, NULL, 3.6, '3164', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 300g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.284, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.3, '157', 0), (emp, tab, 21, 100, 3.2, '1572', 1), (emp, tab, 101, 300, 2.7, '1573', 2), (emp, tab, 301, NULL, 2.2, '1574', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 300g + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.284, 0.6, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 8.5, '157x', 0), (emp, tab, 21, 100, 5.0, '1572x', 1), (emp, tab, 101, 300, 4.0, '1573x', 2), (emp, tab, 301, NULL, 3.5, '1574x', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 300g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.284, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.5, '160', 0), (emp, tab, 21, 100, 5.6, '1602', 1), (emp, tab, 101, 300, 4.7, '1603', 2), (emp, tab, 301, NULL, 3.8, '1604', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 300g Frente x Verso + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.284, 0.6, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 11.7, '6251', 0), (emp, tab, 21, 100, 7.4, '6252', 1), (emp, tab, 101, 300, 6.0, '6253', 2), (emp, tab, 301, NULL, 5.1, '6254', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Kraft 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.144, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.8, '5507', 0), (emp, tab, 21, 100, 2.8, '5508', 1), (emp, tab, 101, 300, 2.4, '5509', 2), (emp, tab, 301, NULL, 1.9, '5510', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Kraft 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.144, 0.0, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.0, '5511', 0), (emp, tab, 21, 100, 5.2, '5512', 1), (emp, tab, 101, 300, 4.4, '5513', 2), (emp, tab, 301, NULL, 3.5, '5514', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Papel Adesivo', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.332, 0.0, 0.0, 6) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.5, '234', 0), (emp, tab, 21, 100, 3.4, '2342', 1), (emp, tab, 101, 300, 2.8, '2343', 2), (emp, tab, 301, NULL, 2.3, '2344', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Papel Adesivo + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.332, 0.6, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.0, '234x', 0), (emp, tab, 21, 100, 5.1, '234x2', 1), (emp, tab, 101, 300, 4.2, '234x3', 2), (emp, tab, 301, NULL, 3.4, '234x4', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Reciclato 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.176, 0.0, 0.0, 7) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.9, NULL, 0), (emp, tab, 21, 100, 2.9, NULL, 1), (emp, tab, 101, 300, 2.5, NULL, 2), (emp, tab, 301, NULL, 2.0, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Reciclato 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.219, 0.0, 0.0, 8) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.1, '4935', 0), (emp, tab, 21, 100, 3.1, '4936', 1), (emp, tab, 101, 300, 2.6, '4937', 2), (emp, tab, 301, NULL, 2.0, '4938', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Reciclato 240g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.219, 0.0, 0.0, 9) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.3, '047', 0), (emp, tab, 21, 100, 5.5, '0472', 1), (emp, tab, 101, 300, 4.6, '0473', 2), (emp, tab, 301, NULL, 3.6, '0474', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Reciclato 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.064, 0.0, 0.0, 10) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.4, NULL, 0), (emp, tab, 21, 100, 2.6, NULL, 1), (emp, tab, 101, 300, 2.2, NULL, 2), (emp, tab, 301, NULL, 1.7, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Reciclato 75g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.064, 0.0, 0.0, 11) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 6.6, '6187', 0), (emp, tab, 21, 100, 5.0, '6188', 1), (emp, tab, 101, 300, 4.2, '6189', 2), (emp, tab, 301, NULL, 3.3, '6190', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Sulfite 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.144, 0.0, 0.0, 12) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.8, '232', 0), (emp, tab, 21, 100, 2.8, '2322', 1), (emp, tab, 101, 300, 2.4, '2323', 2), (emp, tab, 301, NULL, 1.9, '2324', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Sulfite 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.144, 0.0, 0.0, 13) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.0, '306', 0), (emp, tab, 21, 100, 5.2, '3062', 1), (emp, tab, 101, 300, 4.4, '3063', 2), (emp, tab, 301, NULL, 3.5, '3064', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Sulfite 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.197, 0.0, 0.0, 14) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.0, '493', 0), (emp, tab, 21, 100, 3.0, '4932', 1), (emp, tab, 101, 300, 2.5, '4933', 2), (emp, tab, 301, NULL, 2.0, '4934', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Sulfite 240g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.197, 0.0, 0.0, 15) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.2, '516', 0), (emp, tab, 21, 100, 5.4, '5162', 1), (emp, tab, 101, 300, 4.5, '5163', 2), (emp, tab, 301, NULL, 3.6, '5164', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Sulfite 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.038, 0.0, 0.0, 16) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.4, '154', 0), (emp, tab, 21, 100, 2.6, '1542', 1), (emp, tab, 101, 300, 2.1, '1543', 2), (emp, tab, 301, NULL, 1.7, '1544', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Sulfite 75g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.038, 0.0, 0.0, 17) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 6.6, '231', 0), (emp, tab, 21, 100, 5.0, '2312', 1), (emp, tab, 101, 300, 4.1, '2313', 2), (emp, tab, 301, NULL, 3.3, '2314', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Superbond 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.077, 0.0, 0.0, 18) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.5, '6172', 0), (emp, tab, 21, 100, 2.6, '6173', 1), (emp, tab, 101, 300, 2.2, '6174', 2), (emp, tab, 301, NULL, 1.8, '5184', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Superbond 75g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.077, 0.0, 0.0, 19) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 6.7, '6183', 0), (emp, tab, 21, 100, 5.0, '6184', 1), (emp, tab, 101, 300, 4.2, '6185', 2), (emp, tab, 301, NULL, 3.4, '6186', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A3 180g Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.0, 0.0, 0.0, 20) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 12.6, '5545', 0), (emp, tab, 11, 50, 10.7, '5546', 1), (emp, tab, 51, 100, 9.8, '5547', 2), (emp, tab, 101, NULL, 9.2, '5548', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A3 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.0, 0.0, 0.0, 21) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 18.6, '5549', 0), (emp, tab, 11, 50, 15.7, '5550', 1), (emp, tab, 51, 100, 14.3, '5551', 2), (emp, tab, 101, NULL, 13.6, '5552', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A3 250g Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.0, 0.0, 0.0, 22) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 14.0, '297', 0), (emp, tab, 11, 50, 11.8, '2972', 1), (emp, tab, 51, 100, 10.8, '2973', 2), (emp, tab, 101, NULL, 10.2, '2974', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A3 250g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.0, 0.0, 0.0, 23) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 19.9, '299', 0), (emp, tab, 11, 50, 16.8, '2992', 1), (emp, tab, 51, 100, 15.4, '2993', 2), (emp, tab, 101, NULL, 14.6, '2994', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A4 180g Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.0, 0.0, 0.0, 24) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 6.0, '5537', 0), (emp, tab, 11, 50, 5.0, '5538', 1), (emp, tab, 51, 100, 4.6, '5539', 2), (emp, tab, 101, NULL, 4.3, '5540', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A4 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.0, 0.0, 0.0, 25) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 8.9, '5541', 0), (emp, tab, 11, 50, 7.5, '5542', 1), (emp, tab, 51, 100, 6.9, '5543', 2), (emp, tab, 101, NULL, 6.5, '5544', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A4 250g Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.0, 0.0, 0.0, 26) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 6.6, '298', 0), (emp, tab, 11, 50, 5.5, '2982', 1), (emp, tab, 51, 100, 5.1, '2983', 2), (emp, tab, 101, NULL, 4.8, '2984', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Colorplus Metálico A4 250g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.0, 0.0, 0.0, 27) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 9.5, '296', 0), (emp, tab, 11, 50, 8.0, '2962', 1), (emp, tab, 51, 100, 7.3, '2963', 2), (emp, tab, 101, NULL, 6.9, '2964', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Crachás';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Crachá PVC 1 Lado', 'manual', NULL, NULL, 'A4', 1, 4.17, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 18.6, '598', 0), (emp, tab, 11, 20, 12.8, '5982', 1), (emp, tab, 21, 50, 11.1, '5983', 2), (emp, tab, 51, NULL, 9.8, '5984', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Crachás';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Crachá PVC 2 Lados', 'manual', NULL, NULL, 'A4', 2, 5.76, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 25.9, '599', 0), (emp, tab, 11, 20, 21.9, '5992', 1), (emp, tab, 21, 50, 18.9, '5993', 2), (emp, tab, 51, NULL, 16.7, '5994', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Crachás';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Crachá PVC 2 Lados Com Chip', 'manual', NULL, NULL, 'A4', 2, 5.76, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 28.9, '6102', 0);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Inkjet Color ENVELOPE CARTA BRANCO - 11,4X16,2cm Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 1, 0.1144, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 1.8, '6111', 0), (emp, tab, 6, 20, 1.3, '6112', 1), (emp, tab, 21, 50, 1.0, '6113', 2), (emp, tab, 51, NULL, 0.8, '6114', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Inkjet Color ENVELOPE CARTA BRANCO - 11,4X16,2cm Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 2, 0.1144, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 2.6, '6115', 0), (emp, tab, 6, 20, 1.8, '6116', 1), (emp, tab, 21, 50, 1.4, '6117', 2), (emp, tab, 51, NULL, 1.2, '6118', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Colorplus Cores Vivas A4 180g Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.693, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 4.5, '6103', 0), (emp, tab, 11, 50, 3.5, '6104', 1), (emp, tab, 51, 100, 2.8, '6105', 2), (emp, tab, 101, NULL, 2.4, '6106', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Colorplus Cores Vivas A4 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 2, 0.693, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 5.2, '6107', 0), (emp, tab, 11, 50, 4.0, '6108', 1), (emp, tab, 51, 100, 3.3, '6109', 2), (emp, tab, 101, NULL, 2.8, '6110', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Colorplus Metálico A3 250g Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.0, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 14.0, '526', 0), (emp, tab, 11, 50, 10.8, '5262', 1), (emp, tab, 51, 100, 8.8, '5263', 2), (emp, tab, 101, NULL, 7.5, '5264', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Colorplus Metálico A4 250g Frente', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.0, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 6.3, '527', 0), (emp, tab, 11, 50, 4.9, '5272', 1), (emp, tab, 51, 100, 4.0, '5273', 2), (emp, tab, 101, NULL, 3.3, '5274', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB em Papel Adesivo A3 + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.747, 1.19, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 6.8, '229x', 0);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB em Papel Adesivo A4 + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.332, 0.6, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.1, '228x', 0);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB ENVELOPE CARTA BRANCO - 11,4X16,2cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.1144, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 1.7, '6010', 0), (emp, tab, 6, 20, 1.2, '6011', 1), (emp, tab, 21, 50, 0.9, '6012', 2), (emp, tab, 51, NULL, 0.8, '6013', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB ENVELOPE OFÍCIO - 11,4X22,9cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.1321, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 2.8, '6047', 0), (emp, tab, 6, 20, 2.0, '6048', 1), (emp, tab, 21, 50, 1.5, '6049', 2), (emp, tab, 51, NULL, 1.3, '6050', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB ENVELOPE SACO BRANCO - 18,5 X 24,8 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.1942, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 4.3, '6051', 0), (emp, tab, 6, 20, 3.0, '6052', 1), (emp, tab, 21, 50, 2.3, '6053', 2), (emp, tab, 51, NULL, 1.9, '6054', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB ENVELOPE SACO BRANCO - 26,0 x 36,0 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.5732, 0.0, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 6.7, '6055', 0), (emp, tab, 6, 20, 4.7, '6056', 1), (emp, tab, 21, 50, 3.6, '6057', 2), (emp, tab, 51, NULL, 3.0, '6058', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB ENVELOPE SACO KRAFT NATURAL - 26,0 x 36,0 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.438, 0.0, 0.0, 6) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 5.3, '6059', 0), (emp, tab, 6, 20, 3.7, '6060', 1), (emp, tab, 21, 50, 2.9, '6061', 2), (emp, tab, 51, NULL, 2.3, '6062', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB ENVELOPE SACO OURO - 12,5 x 17,6 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.3036, 0.0, 0.0, 7) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 4.3, '6063', 0), (emp, tab, 6, 20, 3.0, '6064', 1), (emp, tab, 21, 50, 2.3, '6065', 2), (emp, tab, 51, NULL, 1.9, '6066', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB ENVELOPE SACO OURO - 26,0 x 36,0 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.5844, 0.0, 0.0, 8) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 6.8, '6067', 0), (emp, tab, 6, 20, 4.8, '6068', 1), (emp, tab, 21, 50, 3.7, '6069', 2), (emp, tab, 51, NULL, 3.0, '6070', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Autocopiativo CB 1via', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.097, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.3, '520', 0), (emp, tab, 51, 200, 0.9, '5202', 1), (emp, tab, 201, 500, 0.8, '5203', 2), (emp, tab, 501, NULL, 0.6, '5204', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Autocopiativo CFB 2via', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.113, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 0.9, '6152', 0), (emp, tab, 51, 300, 0.8, '6153', 1), (emp, tab, 301, 1000, 0.7, '6154', 2), (emp, tab, 1001, NULL, 0.5, '6155', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Cartolina 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.186, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.5, '6274', 0), (emp, tab, 51, 300, 1.1, '6275', 1), (emp, tab, 301, 1000, 0.8, '6276', 2), (emp, tab, 1001, NULL, 0.4, '6277', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Cartolina 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 2, 0.186, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.0, '6278', 0), (emp, tab, 51, 300, 2.2, '6279', 1), (emp, tab, 301, 1000, 1.6, '6280', 2), (emp, tab, 1001, NULL, 0.8, '6281', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Papel Adesivo', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.332, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.9, '6168', 0), (emp, tab, 51, 300, 1.7, '6169', 1), (emp, tab, 301, 1000, 1.3, '6170', 2), (emp, tab, 1001, NULL, 1.1, '6171', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Reciclato 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.064, 0.0, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 0.6, '6164', 0), (emp, tab, 51, 300, 0.4, '6165', 1), (emp, tab, 301, 1000, 0.3, '6166', 2), (emp, tab, 1001, NULL, 0.2, '6167', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Sulfite 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.144, 0.0, 0.0, 6) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.6, '6282', 0), (emp, tab, 51, 300, 0.9, '6283', 1), (emp, tab, 301, 1000, 0.7, '6284', 2), (emp, tab, 1001, NULL, 0.6, '6285', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Sulfite 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 2, 0.144, 0.0, 0.0, 7) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.2, '6286', 0), (emp, tab, 51, 300, 1.8, '6287', 1), (emp, tab, 301, 1000, 1.4, '6288', 2), (emp, tab, 1001, NULL, 1.2, '6289', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Sulfite 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.038, 0.0, 0.0, 8) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 0.5, '6156', 0), (emp, tab, 51, 300, 0.4, '6157', 1), (emp, tab, 301, 1000, 0.3, '6158', 2), (emp, tab, 1001, NULL, 0.2, '6159', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Inkjet A4 Superbond 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'pb', 'A4', 1, 0.077, 0.0, 0.0, 9) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 0.7, '6160', 0), (emp, tab, 51, 300, 0.5, '6161', 1), (emp, tab, 301, 1000, 0.4, '6162', 2), (emp, tab, 1001, NULL, 0.3, '6163', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Kraft A3 180g Frente + Recorte Especial', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.0, 1.19, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 12.3, '6003', 0), (emp, tab, 6, 20, 8.9, '6005', 1), (emp, tab, 21, 50, 6.9, '6004', 2), (emp, tab, 51, NULL, 5.0, '6006', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Cartolina 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.4185, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.9, '523', 0), (emp, tab, 51, 300, 2.2, '5232', 1), (emp, tab, 301, 1000, 1.7, '5233', 2), (emp, tab, 1001, NULL, 1.4, '5234', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Couchê 115g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.2205, 0.0, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.5, '381', 0), (emp, tab, 51, 300, 1.4, '3812', 1), (emp, tab, 301, 1000, 1.1, '3813', 2), (emp, tab, 1001, NULL, 0.9, '3814', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Couchê 150g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.2903, 0.0, 0.0, 6) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.0, '391', 0), (emp, tab, 51, 300, 1.7, '3912', 1), (emp, tab, 301, 1000, 1.3, '3913', 2), (emp, tab, 1001, NULL, 1.1, '3914', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Couchê 210g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.2588, 0.0, 0.0, 7) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.9, '395', 0), (emp, tab, 51, 300, 2.2, '3952', 1), (emp, tab, 301, 1000, 1.7, '3953', 2), (emp, tab, 1001, NULL, 1.4, '3954', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Couchê 300g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.639, 0.0, 0.0, 8) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 5.7, '443', 0), (emp, tab, 51, 300, 3.3, '4432', 1), (emp, tab, 301, 1000, 2.5, '4433', 2), (emp, tab, 1001, NULL, 2.1, '4434', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Couchê 300g + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.639, 1.19, 0.0, 6) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 14.2, '443x', 0), (emp, tab, 51, 300, 6.9, '443x2', 1);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Kraft 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.324, 0.0, 0.0, 9) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.2, '550', 0), (emp, tab, 51, 300, 1.8, '5500', 1), (emp, tab, 301, 1000, 1.4, '5501', 2), (emp, tab, 1001, NULL, 1.2, '5502', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Kraft 180g + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.324, 1.19, 0.0, 7) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 11.7, '6255', 0), (emp, tab, 51, 300, 5.2, '6256', 1), (emp, tab, 301, 1000, 4.3, '6257', 2), (emp, tab, 1001, NULL, 3.7, '6258', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Kraft 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.0, 0.0, 0.0, 10) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 5.5, '6130', 0), (emp, tab, 51, 300, 3.2, '6134', 1), (emp, tab, 301, 1000, 2.4, '6135', 2), (emp, tab, 1001, NULL, 2.0, '6136', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Papel Adesivo', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.747, 0.0, 0.0, 11) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 6.5, '229', 0), (emp, tab, 51, 300, 3.7, '2292', 1), (emp, tab, 301, 1000, 2.8, '2293', 2), (emp, tab, 1001, NULL, 2.3, '2294', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Reciclato 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.396, 0.0, 0.0, 12) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.8, '346', 0), (emp, tab, 51, 300, 2.2, '3462', 1), (emp, tab, 301, 1000, 1.6, '3463', 2), (emp, tab, 1001, NULL, 1.4, '3464', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Reciclato 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.4928, 0.0, 0.0, 13) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 4.4, '348', 0), (emp, tab, 51, 300, 2.5, '3482', 1), (emp, tab, 301, 1000, 1.9, '3483', 2), (emp, tab, 1001, NULL, 1.6, '3484', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Reciclato 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.144, 0.0, 0.0, 14) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.0, '249', 0), (emp, tab, 51, 300, 1.1, '2492', 1), (emp, tab, 301, 1000, 0.8, '2493', 2), (emp, tab, 1001, NULL, 0.7, '2494', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Sulfite 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.324, 0.0, 0.0, 15) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 3.2, '373', 0), (emp, tab, 51, 300, 1.8, '3732', 1), (emp, tab, 301, 1000, 1.4, '3733', 2), (emp, tab, 1001, NULL, 1.2, '3734', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Sulfite 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.4433, 0.0, 0.0, 16) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 4.1, '230', 0), (emp, tab, 51, 300, 2.3, '2302', 1), (emp, tab, 301, 1000, 1.7, '2303', 2), (emp, tab, 1001, NULL, 1.5, '2304', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Sulfite 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.0855, 0.0, 0.0, 17) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.9, '361', 0), (emp, tab, 51, 300, 1.1, '3612', 1), (emp, tab, 301, 1000, 0.8, '3613', 2), (emp, tab, 1001, NULL, 0.7, '3614', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A3 Superbond 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A3', 1, 0.1732, 0.0, 0.0, 18) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.2, '519', 0), (emp, tab, 51, 300, 1.2, '5192', 1), (emp, tab, 301, 1000, 0.9, '5193', 2), (emp, tab, 1001, NULL, 0.8, '5194', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Cartolina 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.186, 0.0, 0.0, 19) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.8, '522', 0), (emp, tab, 51, 300, 1.0, '5222', 1), (emp, tab, 301, 1000, 0.8, '5223', 2), (emp, tab, 1001, NULL, 0.7, '5224', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Couchê 115g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.098, 0.0, 0.0, 20) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.2, '379', 0), (emp, tab, 51, 300, 0.7, '3792', 1), (emp, tab, 301, 1000, 0.5, '3793', 2), (emp, tab, 1001, NULL, 0.4, '3794', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Couchê 150g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.129, 0.0, 0.0, 21) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.4, '389', 0), (emp, tab, 51, 300, 0.8, '3892', 1), (emp, tab, 301, 1000, 0.6, '3893', 2), (emp, tab, 1001, NULL, 0.5, '3894', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Couchê 210g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.115, 0.0, 0.0, 22) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.8, '393', 0), (emp, tab, 51, 300, 1.0, '3932', 1), (emp, tab, 301, 1000, 0.8, '3933', 2), (emp, tab, 1001, NULL, 0.7, '3934', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Couchê 300g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.284, 0.0, 0.0, 23) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.6, '350', 0), (emp, tab, 51, 300, 1.5, '3502', 1), (emp, tab, 301, 1000, 1.1, '3503', 2), (emp, tab, 1001, NULL, 0.9, '3504', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Kraft 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.144, 0.0, 0.0, 24) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.5, '5491', 0), (emp, tab, 51, 300, 0.8, '5492', 1), (emp, tab, 301, 1000, 0.6, '5493', 2), (emp, tab, 1001, NULL, 0.5, '5494', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Kraft 180g + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.144, 0.6, 0.0, 8) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 5.7, '6259', 0), (emp, tab, 51, 300, 2.6, '6260', 1), (emp, tab, 301, 1000, 1.9, '6261', 2), (emp, tab, 1001, NULL, 1.8, '6262', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Papel Adesivo', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.332, 0.0, 0.0, 25) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.9, '228', 0), (emp, tab, 51, 300, 1.7, '2282', 1), (emp, tab, 301, 1000, 1.3, '2283', 2), (emp, tab, 1001, NULL, 1.1, '2284', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Reciclato 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.176, 0.0, 0.0, 26) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.8, '345', 0), (emp, tab, 51, 300, 1.0, '3452', 1), (emp, tab, 301, 1000, 0.8, '3453', 2), (emp, tab, 1001, NULL, 0.6, '3454', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Reciclato 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.219, 0.0, 0.0, 27) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.0, '352', 0), (emp, tab, 51, 300, 1.2, '3522', 1), (emp, tab, 301, 1000, 0.9, '3523', 2), (emp, tab, 1001, NULL, 0.7, '3524', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Reciclato 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.064, 0.0, 0.0, 28) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 0.9, '248', 0), (emp, tab, 51, 300, 0.5, '2482', 1), (emp, tab, 301, 1000, 0.4, '2483', 2), (emp, tab, 1001, NULL, 0.3, '2484', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Sulfite 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.144, 0.0, 0.0, 29) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.5, '371', 0), (emp, tab, 51, 300, 0.8, '3712', 1), (emp, tab, 301, 1000, 0.6, '3713', 2), (emp, tab, 1001, NULL, 0.5, '3714', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Sulfite 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.197, 0.0, 0.0, 30) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.9, '227', 0), (emp, tab, 51, 300, 1.1, '2272', 1), (emp, tab, 301, 1000, 0.8, '2273', 2), (emp, tab, 1001, NULL, 0.7, '2274', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Sulfite 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.038, 0.0, 0.0, 31) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.0, '359', 0), (emp, tab, 51, 300, 0.5, '3592', 1), (emp, tab, 301, 1000, 0.4, '3593', 2), (emp, tab, 1001, NULL, 0.3, '3594', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser P&B';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão PB Laser A4 Superbond 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Ricoh 5002' LIMIT 1), 'pb', 'A4', 1, 0.077, 0.0, 0.0, 32) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.1, '518', 0), (emp, tab, 51, 300, 0.6, '5182', 1), (emp, tab, 301, 1000, 0.5, '5183', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laminação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Laminação A3 Brilho/Fosco 1 Lado', 'manual', NULL, NULL, 'A3', 1, 0.6, 0.0, 0.9, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.0, NULL, 0), (emp, tab, 21, 50, 3.5, NULL, 1), (emp, tab, 51, 100, 3.0, NULL, 2), (emp, tab, 101, NULL, 2.0, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laminação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Laminação A3 Brilho/Fosco 2 Lados', 'manual', NULL, NULL, 'A3', 2, 1.2, 0.0, 1.8, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 6.0, NULL, 0), (emp, tab, 21, 50, 5.0, NULL, 1), (emp, tab, 51, 100, 4.5, NULL, 2), (emp, tab, 101, NULL, 3.5, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laminação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Laminação A4 Brilho/Fosco 1 Lado', 'manual', NULL, NULL, 'A4', 1, 0.3, 0.0, 0.4, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 2.0, NULL, 0), (emp, tab, 21, 50, 1.75, NULL, 1), (emp, tab, 51, 100, 1.5, NULL, 2), (emp, tab, 101, NULL, 1.0, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laminação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Laminação A4 Brilho/Fosco 2 Lados', 'manual', NULL, NULL, 'A4', 2, 0.6, 0.0, 0.8, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.0, NULL, 0), (emp, tab, 21, 50, 2.75, NULL, 1), (emp, tab, 51, 100, 2.5, NULL, 2), (emp, tab, 101, NULL, 2.0, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Mouse pads';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Mouse Pad Com Apoio', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 28.0, NULL, 0), (emp, tab, 11, 50, 25.0, NULL, 1), (emp, tab, 51, 100, 22.0, NULL, 2), (emp, tab, 101, 500, 17.0, NULL, 3), (emp, tab, 501, NULL, 14.0, NULL, 4);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Mouse pads';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Mouse Pad Coração Personalizado', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 22.0, '0000000005326', 0), (emp, tab, 6, 50, 19.0, '0000000005333', 1), (emp, tab, 51, 500, 16.0, '0000000005340', 2), (emp, tab, 501, NULL, 10.0, '0000000005357', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Mouse pads';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Mouse Pad Personalizado', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 20.0, '531', 0), (emp, tab, 6, 50, 17.0, '5312', 1), (emp, tab, 51, 500, 14.0, '5313', 2), (emp, tab, 501, NULL, 8.0, '5314', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Plastificação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Plastificação 15x21cm 0.5mm', 'manual', NULL, NULL, 'A4', 1, 0.595, 0.0, 3, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 7.1, '123', 0), (emp, tab, 6, 20, 5.8, '1232', 1), (emp, tab, 21, 50, 4.9, '1233', 2), (emp, tab, 51, NULL, 4.6, '1234', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Plastificação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Plastificação A3 0.5mm', 'manual', NULL, NULL, 'A3', 1, 2.29, 0.0, 4, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 12.8, '239', 0), (emp, tab, 6, 21, 10.5, '2392', 1), (emp, tab, 22, 50, 8.9, '2393', 2), (emp, tab, 51, NULL, 8.2, '2394', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Plastificação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Plastificação A4 0.5mm', 'manual', NULL, NULL, 'A4', 1, 1.19, 0.0, 3, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 8.4, '118', 0), (emp, tab, 6, 20, 6.9, '1182', 1), (emp, tab, 21, 50, 5.8, '1183', 2), (emp, tab, 51, NULL, 5.4, '1184', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Plastificação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Plastificação Carteira 0.5mm', 'manual', NULL, NULL, 'A4', 1, 0.28, 0.0, 3, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 6.4, '117', 0), (emp, tab, 6, 20, 5.2, '1172', 1), (emp, tab, 21, 50, 4.4, '1173', 2), (emp, tab, 51, NULL, 4.1, '1174', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Crachás';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Presilha para Crachá', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 2.0, '5995', 0), (emp, tab, 6, 15, 1.5, '5996', 1), (emp, tab, 16, 30, 1.3, '5997', 2), (emp, tab, 31, 50, 1.1, '5998', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Brindes e outros';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Pulseira de Festa', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.6, NULL, 0), (emp, tab, 51, 100, 1.25, NULL, 1), (emp, tab, 101, 200, 0.6, NULL, 2), (emp, tab, 201, 500, 0.45, NULL, 3), (emp, tab, 501, 1000, 0.4, NULL, 4);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Recorte eletrônico';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Recorte Especial A3 em Papel Adesivo', 'manual', NULL, NULL, 'A3', 1, 0.0, 1.19, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.0, '6231', 0), (emp, tab, 21, 100, 3.0, '6232', 1), (emp, tab, 101, 300, 2.6, '6233', 2), (emp, tab, 301, NULL, 2.4, '6234', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Recorte eletrônico';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Recorte Especial A3 em Papel Couchê', 'manual', NULL, NULL, 'A3', 1, 0.0, 1.19, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 8.5, '6235', 0), (emp, tab, 21, 100, 3.4, '6236', 1), (emp, tab, 101, 300, 2.9, '6237', 2), (emp, tab, 301, NULL, 2.5, '6238', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Recorte eletrônico';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Recorte Especial A3 em Papel Kraft', 'manual', NULL, NULL, 'A3', 1, 0.0, 1.19, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.0, '6239', 0), (emp, tab, 21, 100, 3.0, '6240', 1), (emp, tab, 101, 300, 2.6, '6241', 2), (emp, tab, 301, NULL, 2.4, '6242', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Recorte eletrônico';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Recorte Especial A4 em Papel Adesivo', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.6, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 2.5, '6227', 0), (emp, tab, 21, 100, 1.8, '6228', 1), (emp, tab, 101, 300, 1.5, '6229', 2), (emp, tab, 301, NULL, 1.2, '6230', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Recorte eletrônico';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Recorte Especial A4 em Papel Couchê', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.6, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.2, '6243', 0), (emp, tab, 21, 100, 1.8, '6244', 1), (emp, tab, 101, 300, 1.3, '6245', 2), (emp, tab, 301, NULL, 1.3, '6246', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Brindes e outros';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Agenda Capa Dura Personalizada 14x20cm', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 65.0, '5', 0), (emp, tab, 6, 12, 55.0, '5.1', 1), (emp, tab, 13, NULL, 50.0, '5.2', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Têxteis e almofadas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Almofada Personalizada 45cm com 1 Estampa', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 50.0, '6017', 0), (emp, tab, 6, 10, 45.0, '6018', 1), (emp, tab, 11, 15, 40.0, '6019', 2), (emp, tab, 16, NULL, 30.0, '6020', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Têxteis e almofadas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Almofada Personalizada 45cm com 2 Estampas', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 60.0, '6021', 0), (emp, tab, 6, 10, 55.0, '6022', 1), (emp, tab, 11, 15, 50.0, '6023', 2), (emp, tab, 16, NULL, 40.0, '6024', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Outros serviços';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Ampliação ou Redução', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 5.0, '176', 0), (emp, tab, 6, 20, 3.0, '1762', 1), (emp, tab, 21, NULL, 2.0, '1763', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Têxteis e almofadas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Body Liso Manga Curta Branco Infantil', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 3, 60.0, '138', 0), (emp, tab, 4, 10, 55.0, '6025', 1), (emp, tab, 11, NULL, 50.0, '6026', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Têxteis e almofadas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Body Liso Manga Longa Branco Infantil', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 3, 65.0, '6027', 0), (emp, tab, 4, 10, 60.0, '6028', 1), (emp, tab, 11, NULL, 55.0, '6029', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Canecas, copos e garrafas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Caneca Mágica Personalizada -', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 1, 70.0, '5483', 0), (emp, tab, 2, 5, 65.0, '5484', 1), (emp, tab, 6, 20, 55.0, '5485', 2), (emp, tab, 21, NULL, 50.0, '5486', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Canecas, copos e garrafas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Caneca Personalizada - Branca Padrão', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 1, 45.0, NULL, 0), (emp, tab, 2, 5, 40.0, NULL, 1), (emp, tab, 6, 20, 35.0, '5482', 2), (emp, tab, 21, NULL, 30.0, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Canecas, copos e garrafas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Caneca Preta -', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 77.0, '0000000005401', 0), (emp, tab, 6, 50, 55.0, '0000000005418', 1), (emp, tab, 51, NULL, 50.0, '0000000005425', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Brindes e outros';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Caneta Personalizada 1 Cor', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 100, 0.0, '624', 0), (emp, tab, 101, 500, 0.0, '624', 1), (emp, tab, 501, 1000, 0.0, '624', 2), (emp, tab, 1001, NULL, 0.0, '624', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Brindes e outros';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Caneta Personalizada 2 Cores', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 100, 0.0, '628', 0), (emp, tab, 101, 500, 0.0, '628', 1), (emp, tab, 501, 1000, 0.0, '628', 2), (emp, tab, 1001, NULL, 0.0, '628', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Brindes e outros';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Cartões de Bloqueio Tam. 13x9,5cm + 1 Ilhós', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 1, 10.0, '5455', 0), (emp, tab, 2, 20, 9.0, '5456', 1), (emp, tab, 21, 30, 8.0, '5457', 2), (emp, tab, 31, 40, 7.0, '5458', 3), (emp, tab, 41, 41, 6.5, '5459', 4);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Canecas, copos e garrafas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Copo Térmico Personalizado', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 49.9, NULL, 0), (emp, tab, 11, 20, 39.9, NULL, 1), (emp, tab, 21, 50, 36.9, NULL, 2), (emp, tab, 51, NULL, 29.9, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Crachás';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Cordinha lisa para crachá com Presilha Jacaré', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 2.5, '5999', 0), (emp, tab, 6, 15, 2.0, '6000', 1), (emp, tab, 16, 30, 1.8, '6001', 2), (emp, tab, 31, 50, 1.5, '6002', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Canecas, copos e garrafas';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Cordões para Canecas "ARGOLA"', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 30, 12.0, '0000000005364', 0), (emp, tab, 31, 40, 11.0, '0000000005371', 1), (emp, tab, 41, 51, 10.0, '0000000005388', 2), (emp, tab, 52, NULL, 6.0, '0000000005395', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Digitalização';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Digitalização de Documento Alimentador Automático A3', 'manual', NULL, NULL, 'A3', 1, 0.0, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 0.7, '220', 0), (emp, tab, 21, 50, 0.65, '220', 1), (emp, tab, 51, NULL, 0.6, '220', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Digitalização';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Digitalização de Documento Alimentador Automático A4', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 0.5, '244', 0), (emp, tab, 21, 50, 0.45, '244', 1), (emp, tab, 51, NULL, 0.4, '244', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Digitalização';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Digitalização de Documento Individual A3', 'manual', NULL, NULL, 'A3', 1, 0.0, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.0, '192', 0), (emp, tab, 21, 50, 2.9, '192', 1), (emp, tab, 51, NULL, 2.8, '192', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Digitalização';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Digitalização de Documento Individual A4', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 2.0, '222', 0), (emp, tab, 21, 50, 1.7, '222', 1), (emp, tab, 51, NULL, 1.2, '222', 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Outros serviços';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Dobra Chapa de PS 2mm', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 10, 1.0, NULL, 0), (emp, tab, 11, 50, 0.7, NULL, 1), (emp, tab, 51, NULL, 0.5, NULL, 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Encadernação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Encadernação Espiral + de 200 Folhas A3', 'manual', NULL, NULL, 'A3', 1, 3.71, 0.0, 7, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 17.0, '111', 0), (emp, tab, 6, 20, 15.7, '1112', 1), (emp, tab, 21, 50, 14.5, '1113', 2), (emp, tab, 51, NULL, 13.5, '1114', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Encadernação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Encadernação Espiral + de 200 Folhas A4', 'manual', NULL, NULL, 'A4', 1, 2.35, 0.0, 5, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 11.6, '107', 0), (emp, tab, 6, 20, 10.7, '1072', 1), (emp, tab, 21, 50, 9.9, '1073', 2), (emp, tab, 51, NULL, 9.2, '1074', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Encadernação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Encadernação Espiral Até 100 Folhas A4', 'manual', NULL, NULL, 'A4', 1, 1.63, 0.0, 3, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 7.5, '105', 0), (emp, tab, 6, 20, 6.8, '1052', 1), (emp, tab, 21, 50, 6.3, '1053', 2), (emp, tab, 51, NULL, 5.8, '1054', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Encadernação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Encadernação Espiral Até 200 Folhas A3', 'manual', NULL, NULL, 'A3', 1, 2.97, 0.0, 6, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 14.2, '110', 0), (emp, tab, 6, 20, 13.1, '1102', 1), (emp, tab, 21, 50, 12.1, '1103', 2), (emp, tab, 51, NULL, 11.3, '1104', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Encadernação';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Encadernação Espiral Até 200 Folhas A4', 'manual', NULL, NULL, 'A4', 1, 2.23, 0.0, 4, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 9.9, '106', 0), (emp, tab, 6, 20, 9.1, '1062', 1), (emp, tab, 21, 50, 8.4, '1063', 2), (emp, tab, 51, NULL, 7.8, '1064', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressões especiais';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color em Papel Transfer Sublimático A4', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 15.0, NULL, 0), (emp, tab, 6, 10, 12.0, NULL, 1), (emp, tab, 11, 20, 10.0, NULL, 2), (emp, tab, 21, 50, 8.0, NULL, 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressões especiais';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão color em Vinil Adesivo A4', 'manual', NULL, NULL, 'A4', 1, 0.0, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 10.0, NULL, 0), (emp, tab, 6, 10, 8.0, NULL, 1), (emp, tab, 11, 20, 7.0, NULL, 2);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color ENVELOPE CARTA BRANCO - 11,4X16,2cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.1144, 0.0, 0.0, 9) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 4.3, '5527', 0), (emp, tab, 6, 20, 3.0, '5528', 1), (emp, tab, 21, 50, 2.3, '5529', 2), (emp, tab, 51, NULL, 1.9, '5530', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color ENVELOPE OFÍCIO - 11,4X22,9cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.1321, 0.0, 0.0, 10) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 4.5, '6071', 0), (emp, tab, 6, 20, 3.2, '6072', 1), (emp, tab, 21, 50, 2.5, '6073', 2), (emp, tab, 51, NULL, 2.0, '6074', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color ENVELOPE SACO BRANCO - 18,5 X 24,8 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.1942, 0.0, 0.0, 11) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 5.9, '6075', 0), (emp, tab, 6, 20, 4.2, '6076', 1), (emp, tab, 21, 50, 3.2, '6077', 2), (emp, tab, 51, NULL, 2.6, '6078', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color ENVELOPE SACO BRANCO - 26,0 x 36,0 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.5732, 0.0, 0.0, 12) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 8.3, '6079', 0), (emp, tab, 6, 20, 5.9, '6080', 1), (emp, tab, 21, 50, 4.5, '6081', 2), (emp, tab, 51, NULL, 3.7, '6082', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color ENVELOPE SACO KRAFT NATURAL - 26,0 x 36,0 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.438, 0.0, 0.0, 13) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 6.9, '6083', 0), (emp, tab, 6, 20, 4.9, '6084', 1), (emp, tab, 21, 50, 3.8, '6085', 2), (emp, tab, 51, NULL, 3.1, '6086', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color ENVELOPE SACO OURO - 12,5 x 17,6 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.3036, 0.0, 0.0, 14) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 5.9, '6087', 0), (emp, tab, 6, 20, 4.2, '6088', 1), (emp, tab, 21, 50, 3.2, '6089', 2), (emp, tab, 51, NULL, 2.6, '6090', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Envelopes';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color ENVELOPE SACO OURO - 26,0 x 36,0 cm', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.5844, 0.0, 0.0, 15) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 5, 8.5, '6091', 0), (emp, tab, 6, 20, 6.0, '6092', 1), (emp, tab, 21, 50, 4.6, '6093', 2), (emp, tab, 51, NULL, 3.8, '6094', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Inkjet A4 Autocopiativo CB 1via', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 1, 0.097, 0.0, 0.0, 0) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.1, '5531', 0), (emp, tab, 51, 200, 1.5, '5532', 1), (emp, tab, 201, 500, 1.3, '5533', 2), (emp, tab, 501, NULL, 1.0, '5534', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Inkjet A4 Autocopiativo CFB 2via', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 1, 0.113, 0.0, 0.0, 1) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 0.9, '6199', 0), (emp, tab, 51, 300, 0.8, '6200', 1), (emp, tab, 301, 1000, 0.7, '6201', 2), (emp, tab, 1001, NULL, 0.5, '6202', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Inkjet A4 Sulfite 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 1, 0.038, 0.0, 0.0, 2) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.0, '178', 0), (emp, tab, 51, 300, 0.7, '1782', 1), (emp, tab, 301, 1000, 0.6, '1783', 2), (emp, tab, 1001, NULL, 0.7, '1784', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Inkjet A4 Sulfite 75g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 2, 0.038, 0.0, 0.0, 3) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.6, '179', 0), (emp, tab, 51, 300, 1.2, '1792', 1), (emp, tab, 301, 1000, 0.9, '1793', 2), (emp, tab, 1001, NULL, 0.7, '1794', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Inkjet A4 Vergê 80g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 1, 0.18, 0.0, 0.0, 4) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 1.9, '6119', 0), (emp, tab, 51, 300, 1.4, '6120', 1), (emp, tab, 301, 1000, 1.1, '6121', 2), (emp, tab, 1001, NULL, 0.8, '6122', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Jato de tinta Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Inkjet A4 Vergê 80g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Workforce Epson 5710' LIMIT 1), 'color', 'A4', 2, 0.18, 0.0, 0.0, 5) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 50, 2.5, '6203', 0), (emp, tab, 51, 300, 1.8, '6204', 1), (emp, tab, 301, 1000, 1.4, '6205', 2), (emp, tab, 1001, NULL, 1.1, '6206', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Cartolina 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.4185, 0.0, 0.0, 28) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 8.1, '6207', 0), (emp, tab, 21, 100, 6.1, '6208', 1), (emp, tab, 101, 300, 5.1, '6209', 2), (emp, tab, 301, NULL, 4.0, '6210', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Cartolina 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.4185, 0.0, 0.0, 29) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.5, '6219', 0), (emp, tab, 21, 100, 10.9, '6220', 1), (emp, tab, 101, 300, 9.1, '6221', 2), (emp, tab, 301, NULL, 7.2, '6222', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 115g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.2205, 0.0, 0.0, 30) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.3, '271', 0), (emp, tab, 21, 100, 5.5, '2712', 1), (emp, tab, 101, 300, 4.6, '2713', 2), (emp, tab, 301, NULL, 3.6, '2714', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 115g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.2205, 0.0, 0.0, 31) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 13.7, '311', 0), (emp, tab, 21, 100, 10.3, '3112', 1), (emp, tab, 101, 300, 8.6, '3113', 2), (emp, tab, 301, NULL, 6.8, '3114', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 150g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.2903, 0.0, 0.0, 32) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.6, '6211', 0), (emp, tab, 21, 100, 5.7, '6212', 1), (emp, tab, 101, 300, 4.7, '6213', 2), (emp, tab, 301, NULL, 3.8, '6214', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 150g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.2903, 0.0, 0.0, 33) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.0, '6223', 0), (emp, tab, 21, 100, 10.5, '6224', 1), (emp, tab, 101, 300, 8.7, '6225', 2), (emp, tab, 301, NULL, 7.0, '6226', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 210g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.2588, 0.0, 0.0, 34) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 8.1, '276', 0), (emp, tab, 21, 100, 6.1, '2762', 1), (emp, tab, 101, 300, 5.1, '2763', 2), (emp, tab, 301, NULL, 4.0, '2764', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 210g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.2588, 0.0, 0.0, 35) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.5, '317', 0), (emp, tab, 21, 100, 10.9, '3172', 1), (emp, tab, 101, 300, 9.1, '3173', 2), (emp, tab, 301, NULL, 7.2, '3174', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 300g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.639, 0.0, 0.0, 36) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 9.0, '186', 0), (emp, tab, 21, 100, 6.7, '1862', 1), (emp, tab, 101, 300, 5.6, '1863', 2), (emp, tab, 301, NULL, 4.5, '1864', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 300g + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.639, 1.19, 0.0, 9) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 17.5, '186x', 0), (emp, tab, 21, 100, 10.1, '186x2', 1), (emp, tab, 101, 300, 8.5, '186x3', 2), (emp, tab, 301, NULL, 7.0, '186x4', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 300g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.639, 0.0, 0.0, 37) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 15.4, '187', 0), (emp, tab, 21, 100, 11.5, '1872', 1), (emp, tab, 101, 300, 9.6, '1873', 2), (emp, tab, 301, NULL, 7.7, '1874', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Couchê 300g Frente x Verso + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.639, 1.19, 0.0, 10) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 23.9, '187x', 0), (emp, tab, 21, 100, 14.9, '1872x', 1), (emp, tab, 101, 300, 12.5, '1873x', 2), (emp, tab, 301, NULL, 10.2, '1874x', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Kraft 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.324, 0.0, 0.0, 38) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.7, '5515', 0), (emp, tab, 21, 100, 5.8, '5516', 1), (emp, tab, 101, 300, 4.8, '5517', 2), (emp, tab, 301, NULL, 3.8, '5518', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Kraft 180g + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.324, 1.19, 0.0, 11) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 11.7, '6265', 0), (emp, tab, 21, 100, 8.8, '6266', 1), (emp, tab, 101, 300, 7.4, '6267', 2), (emp, tab, 301, NULL, 6.2, '6268', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Kraft 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.324, 0.0, 0.0, 39) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.1, '5519', 0), (emp, tab, 21, 100, 10.6, '5520', 1), (emp, tab, 101, 300, 8.8, '5521', 2), (emp, tab, 301, NULL, 7.0, '5522', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Papel Adesivo', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.747, 0.0, 0.0, 40) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 10.5, '277', 0), (emp, tab, 21, 100, 7.1, '2772', 1), (emp, tab, 101, 300, 5.9, '2773', 2), (emp, tab, 301, NULL, 4.7, '2774', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Impressão + Recorte';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Papel Adesivo + Recorte Eletrônico', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.747, 1.19, 0.0, 12) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.5, '277x', 0), (emp, tab, 21, 100, 10.1, '277x2', 1), (emp, tab, 101, 300, 8.5, '277x3', 2), (emp, tab, 301, NULL, 7.1, '277x4', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Reciclato 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.4928, 0.0, 0.0, 41) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 8.4, '050', 0), (emp, tab, 21, 100, 6.3, '0502', 1), (emp, tab, 101, 300, 5.2, '0503', 2), (emp, tab, 301, NULL, 4.2, '0504', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Reciclato 240g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.4928, 0.0, 0.0, 42) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.8, '054', 0), (emp, tab, 21, 100, 11.1, '0542', 1), (emp, tab, 101, 300, 9.2, '0543', 2), (emp, tab, 301, NULL, 7.4, '0544', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Reciclato 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.144, 0.0, 0.0, 43) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.0, '020', 0), (emp, tab, 21, 100, 5.2, '0202', 1), (emp, tab, 101, 300, 4.4, '0203', 2), (emp, tab, 301, NULL, 3.5, '0204', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Reciclato 75g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.144, 0.0, 0.0, 44) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 13.4, '021', 0), (emp, tab, 21, 100, 10.0, '0212', 1), (emp, tab, 101, 300, 8.4, '0213', 2), (emp, tab, 301, NULL, 6.7, '0214', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Sulfite 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.324, 0.0, 0.0, 45) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.7, '233', 0), (emp, tab, 21, 100, 5.8, '2332', 1), (emp, tab, 101, 300, 4.8, '2333', 2), (emp, tab, 301, NULL, 3.8, '2334', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Sulfite 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.324, 0.0, 0.0, 46) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.1, '307', 0), (emp, tab, 21, 100, 10.6, '3072', 1), (emp, tab, 101, 300, 8.8, '3073', 2), (emp, tab, 301, NULL, 7.0, '3074', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Sulfite 240g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.4433, 0.0, 0.0, 47) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 8.2, '492', 0), (emp, tab, 21, 100, 6.1, '4922', 1), (emp, tab, 101, 300, 5.1, '4923', 2), (emp, tab, 301, NULL, 4.1, '4924', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Sulfite 240g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.4433, 0.0, 0.0, 48) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 14.6, '491', 0), (emp, tab, 21, 100, 10.9, '4912', 1), (emp, tab, 101, 300, 9.1, '4913', 2), (emp, tab, 301, NULL, 7.3, '4914', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Sulfite 75g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 1, 0.0855, 0.0, 0.0, 49) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 6.9, '278', 0), (emp, tab, 21, 100, 5.2, '2782', 1), (emp, tab, 101, 300, 4.3, '2783', 2), (emp, tab, 301, NULL, 3.5, '2784', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A3 Sulfite 75g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A3', 2, 0.0855, 0.0, 0.0, 50) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 13.3, '279', 0), (emp, tab, 21, 100, 10.0, '2792', 1), (emp, tab, 101, 300, 8.3, '2793', 2), (emp, tab, 301, NULL, 6.7, '2794', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Cartolina 180g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.186, 0.0, 0.0, 51) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 4.0, '6175', 0), (emp, tab, 21, 100, 3.0, '6176', 1), (emp, tab, 101, 300, 2.5, '6177', 2), (emp, tab, 301, NULL, 2.0, '6178', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Cartolina 180g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.186, 0.0, 0.0, 52) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 7.2, '6191', 0), (emp, tab, 21, 100, 5.4, '6192', 1), (emp, tab, 101, 300, 4.5, '6193', 2), (emp, tab, 301, NULL, 3.6, '6194', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 115g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.098, 0.0, 0.0, 53) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.6, '273', 0), (emp, tab, 21, 100, 2.7, '2732', 1), (emp, tab, 101, 300, 1.8, '2733', 2), (emp, tab, 301, NULL, 2.4, '2734', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 115g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.098, 0.0, 0.0, 54) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 6.8, '310', 0), (emp, tab, 21, 100, 5.1, '3102', 1), (emp, tab, 101, 300, 4.3, '3103', 2), (emp, tab, 301, NULL, 3.4, '3104', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 150g', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 1, 0.129, 0.0, 0.0, 55) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 3.7, '6179', 0), (emp, tab, 21, 100, 2.8, '6180', 1), (emp, tab, 101, 300, 2.3, '6181', 2), (emp, tab, 301, NULL, 1.9, '6182', 3);
  SELECT id INTO cat FROM public.price_table_categories WHERE empresa_id = emp AND name = 'Laser Colorida';
  INSERT INTO public.price_tables (empresa_id, category_id, name, calc_type, equipment_id, color_mode, sheet_size, sides, material_cost, extra_cost, minutes_per_unit, sort_order)
  VALUES (emp, cat, 'Impressão Color Laser A4 Couchê 150g Frente x Verso', 'impressao', (SELECT id FROM public.equipments WHERE empresa_id = emp AND name = 'Xerox C70' LIMIT 1), 'color', 'A4', 2, 0.129, 0.0, 0.0, 56) RETURNING id INTO tab;
  INSERT INTO public.price_table_tiers (empresa_id, price_table_id, min_qty, max_qty, price, tiny_sku, sort_order) VALUES (emp, tab, 1, 20, 6.9, '6195', 0), (emp, tab, 21, 100, 5.2, '6196', 1), (emp, tab, 101, 300, 4.3, '6197', 2), (emp, tab, 301, NULL, 3.5, '6198', 3);
END $$;
