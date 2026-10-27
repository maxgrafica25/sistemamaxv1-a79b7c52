begin;
create temp table _emp as select id from public.empresas where nome = 'Max Gráfica';

-- 1) Máquinas (apaga e recria só as desta lista, para poder rodar de novo)
delete from public.equipments where empresa_id = (select id from _emp)
  and name in ('Xerox C70','Ricoh 5002','Workforce Epson 5710','Fargo C50','Plotter recorte Ultrajet Z3','Plotter recorte Ultracam','Canon TM300','Konica 368');
insert into public.equipments (empresa_id, name, printer_type, description, sort_order)
select (select id from _emp), n, t, d, o from (values
  ('Xerox C70', 'color', 'Laser colorida', 1),
  ('Ricoh 5002', 'pb', 'Laser preto e branco', 2),
  ('Workforce Epson 5710', 'color', 'Jato de tinta colorida (bulk)', 3),
  ('Fargo C50', 'ribbon', 'Impressora de crachá PVC — custo por cartão', 4),
  ('Plotter recorte Ultrajet Z3', 'other', 'Recorte — custo por folha SRA3 cortada', 5),
  ('Plotter recorte Ultracam', 'other', 'Recorte — custo por metro linear', 6),
  ('Canon TM300', 'other', 'Plotter de impressão (m²) — consumíveis a cadastrar', 7),
  ('Konica 368', 'color', 'Laser colorida', 8)
) as e(n, d, t, o);

-- 2) Consumíveis: preço, rendimento (fabricante, 5%), varia com a cobertura?, só nas coloridas?
insert into public.equipment_consumables (empresa_id, equipment_id, name, price, yield_pages, scales_with_coverage, mode, sort_order)
select (select id from _emp), eq.id, c.n, c.p, c.r, c.s, c.m, c.o
from (values
  ('Xerox C70', 'Toner preto', 700, 35000, true, 'shared', 1),
  ('Xerox C70', 'Toner ciano', 700, 35000, true, 'color_only', 2),
  ('Xerox C70', 'Toner magenta', 700, 35000, true, 'color_only', 3),
  ('Xerox C70', 'Toner amarelo', 700, 35000, true, 'color_only', 4),
  ('Xerox C70', 'Revelador preto (unid. + pó)', 2125, 600000, false, 'shared', 5),
  ('Xerox C70', 'Revelador ciano (unid. + pó)', 2125, 600000, false, 'color_only', 6),
  ('Xerox C70', 'Revelador magenta (unid. + pó)', 2125, 600000, false, 'color_only', 7),
  ('Xerox C70', 'Revelador amarelo (unid. + pó)', 2125, 600000, false, 'color_only', 8),
  ('Xerox C70', 'Cilindro preto', 1600, 80000, false, 'shared', 9),
  ('Xerox C70', 'Cilindro ciano', 1600, 115000, false, 'color_only', 10),
  ('Xerox C70', 'Cilindro magenta', 1600, 115000, false, 'color_only', 11),
  ('Xerox C70', 'Cilindro amarelo', 1600, 115000, false, 'color_only', 12),
  ('Xerox C70', 'Belt + lâmina de limpeza', 2850, 300000, false, 'shared', 13),
  ('Xerox C70', 'Fusão', 1500, 300000, false, 'shared', 14),
  ('Xerox C70', 'Manutenção (2 chamados ao ano)', 1500, 80000, false, 'shared', 15),
  ('Xerox C70', 'Depreciação (R$ 25.000 compra − R$ 5.000 residual)', 20000, 1000000, false, 'shared', 16),
  ('Ricoh 5002', 'Toner preto', 220, 30000, true, 'shared', 1),
  ('Ricoh 5002', 'Rolo fusor', 200, 150000, false, 'shared', 2),
  ('Ricoh 5002', 'Tela de limpeza da fusão', 150, 150000, false, 'shared', 3),
  ('Ricoh 5002', 'Revelador', 1050, 150000, false, 'shared', 4),
  ('Ricoh 5002', 'Belt + lâmina de limpeza', 2125, 500000, false, 'shared', 5),
  ('Ricoh 5002', 'Cilindro + lâmina', 600, 200000, false, 'shared', 6),
  ('Ricoh 5002', 'Manutenção', 2100, 80000, false, 'shared', 7),
  ('Ricoh 5002', 'Depreciação (R$ 7.000 compra − R$ 2.500 residual)', 4500, 500000, false, 'shared', 8),
  ('Workforce Epson 5710', 'Tinta preta (bulk)', 178, 50000, true, 'shared', 1),
  ('Workforce Epson 5710', 'Tinta ciano (bulk)', 204, 40000, true, 'color_only', 2),
  ('Workforce Epson 5710', 'Tinta magenta (bulk)', 204, 40000, true, 'color_only', 3),
  ('Workforce Epson 5710', 'Tinta amarela (bulk)', 204, 40000, true, 'color_only', 4),
  ('Workforce Epson 5710', 'Almofadas', 30, 35000, false, 'shared', 5),
  ('Workforce Epson 5710', 'Manutenção', 500, 90000, false, 'shared', 6),
  ('Workforce Epson 5710', 'Depreciação', 6500, 250000, false, 'shared', 7),
  ('Fargo C50', 'Ribbon colorido', 398, 250, false, 'shared', 1),
  ('Fargo C50', 'Cartão PVC', 340, 500, false, 'shared', 2),
  ('Fargo C50', 'Depreciação', 9500, 5000, false, 'shared', 3),
  ('Plotter recorte Ultrajet Z3', 'Depreciação', 18500, 20000, false, 'shared', 1),
  ('Plotter recorte Ultrajet Z3', 'Teflon', 250, 1500, false, 'shared', 2),
  ('Plotter recorte Ultrajet Z3', 'Lâmina', 50, 500, false, 'shared', 3),
  ('Plotter recorte Ultracam', 'Depreciação', 12500, 5000, false, 'shared', 1),
  ('Plotter recorte Ultracam', 'Teflon', 300, 2500, false, 'shared', 2),
  ('Plotter recorte Ultracam', 'Lâmina', 50, 250, false, 'shared', 3),
  ('Konica 368', 'Toner preto', 160, 29000, true, 'shared', 1),
  ('Konica 368', 'Toner ciano', 199, 26000, true, 'color_only', 2),
  ('Konica 368', 'Toner magenta', 199, 26000, true, 'color_only', 3),
  ('Konica 368', 'Toner amarelo', 199, 26000, true, 'color_only', 4),
  ('Konica 368', 'Revelador preto (unid. + pó)', 500, 100000, false, 'shared', 5),
  ('Konica 368', 'Revelador ciano (unid. + pó)', 500, 100000, false, 'color_only', 6),
  ('Konica 368', 'Revelador magenta (unid. + pó)', 500, 100000, false, 'color_only', 7),
  ('Konica 368', 'Revelador amarelo (unid. + pó)', 500, 100000, false, 'color_only', 8),
  ('Konica 368', 'Cilindro preto', 350, 120000, false, 'shared', 9),
  ('Konica 368', 'Cilindro ciano', 295, 75000, false, 'color_only', 10),
  ('Konica 368', 'Cilindro magenta', 295, 75000, false, 'color_only', 11),
  ('Konica 368', 'Cilindro amarelo', 295, 75000, false, 'color_only', 12),
  ('Konica 368', 'Belt + lâmina de limpeza', 1000, 280000, false, 'shared', 13),
  ('Konica 368', 'Fusão', 2500, 300000, false, 'shared', 14),
  ('Konica 368', 'Manutenção (4 chamados ao ano)', 2000, 50000, false, 'shared', 15),
  ('Konica 368', 'Depreciação (R$ 14.000 compra − R$ 5.000 residual)', 9000, 500000, false, 'shared', 16)
) as c(e, n, p, r, s, m, o)
join public.equipments eq on eq.name = c.e and eq.empresa_id = (select id from _emp);

-- 3) Despesas Fixas: tira o que agora está no custo por página (não cobrar duas vezes)
delete from public.equipment_depreciation where empresa_id = (select id from _emp)
  and name in ('Ricoh 5002','Konica 368','Xerox 252','Plotter recorte grande','Plotter recorte mesa');
delete from public.monthly_expenses where empresa_id = (select id from _emp)
  and name in ('Manutenção Ricoh','Manutenção Xerox');
-- Canon TM300 continua no valor da hora (sem custo por m² ainda), com o valor da nota
update public.equipment_depreciation set name = 'Plotter Canon TM300', purchase_value = 25500, residual_value = 2500
where empresa_id = (select id from _emp) and name in ('Plotter Canon', 'Plotter Canon TM300');

-- 4) Despesas de venda padrão: imposto 10%, perda 5%, cobrança 7%, lucro 33%
update public.global_settings set invoice_pct = 10, tax_pct = 0, waste_pct = 5,
  collection_pct = 7, collection_fee_pct = 7, credit_card_pct = 0, default_margin_pct = 33;

select (select count(*) from public.equipments) as maquinas,
       (select count(*) from public.equipment_consumables) as consumiveis,
       round(((select sum(value) from public.monthly_expenses)
             + (select sum(salary) from public.salaries) * 1.45
             + (select sum((purchase_value - residual_value) / useful_life_months) from public.equipment_depreciation))
             / (select hours_per_month * production_employees from public.productive_capacity)::numeric, 2) as novo_valor_hora;
commit;
