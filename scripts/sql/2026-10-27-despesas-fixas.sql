-- Despesas fixas da planilha "Precificação por TEMPO" (valores como estavam na planilha).
-- Roda uma vez no SQL Editor do Supabase; depois os valores são editados na tela Despesas Fixas.
begin;
create temp table _emp as select id from public.empresas where nome = 'Max Gráfica';
delete from public.monthly_expenses where empresa_id = (select id from _emp);
delete from public.salaries where empresa_id = (select id from _emp);
delete from public.equipment_depreciation where empresa_id = (select id from _emp);
delete from public.productive_capacity where empresa_id = (select id from _emp);
insert into public.monthly_expenses (empresa_id, name, value) select (select id from _emp), n, v from (values
  ('Aluguel (Predio1 3400/Prédio2 550 / Estac. 200)', 4200),
  ('Contador', 450),
  ('Internet /Telefone Fixo (215) + Telefone Móvel (190)', 405),
  ('Corsan', 80),
  ('Tiny 110 + Gdrive +Locaweb', 270),
  ('Luz (533 média 12meses de 2022)', 550),
  ('Seguro (2.160ano) + IPVA (1.990ano)', 350),
  ('Encargos Públicos - Alvará (R$200ano), Unimed (R$900ano), Lic. Ambiental (R$700ano)', 150),
  ('Loja Online', 100),
  ('Tarifas Bancárias (Pac. Mês Banri R$65mes) + (Pac. Mês Caixa R$69mes) + (Cielo 180mes)', 325),
  ('Marketing', 1000),
  ('Ecommerce (Plataforma 110 + Grupo imagens 70)', 180),
  ('Manutenção Ricoh', 250),
  ('Manutenção Xerox', 250),
  ('Manutenção Ecosolvente', 120),
  ('Limpeza', 250),
  ('Utensílios Diversos (Papel, Copo, lixo, café...)', 400),
  ('Seguro Prédio', 400),
  ('Carro', 1800)) as t(n, v);
insert into public.salaries (empresa_id, name, salary, is_production) select (select id from _emp), n, v, true from (values
  ('Funcionário 1', 1800),
  ('Funcionário 2', 1800),
  ('Funcionário 3', 1800),
  ('Gestor 1', 5000),
  ('Gestor 2', 5000)) as t(n, v);
insert into public.equipment_depreciation (empresa_id, name, purchase_value, residual_value, useful_life_months) select (select id from _emp), n, p, r, m from (values
  ('Ricoh 5002', 7000, 2500, 60),
  ('Konica 368', 14000, 5000, 60),
  ('Xerox 252', 35000, 5000, 60),
  ('Computadores', 15000, 5000, 60),
  ('Plotter Canon', 28000, 2500, 60),
  ('Plotter Ecosolvente', 65000, 10000, 60),
  ('Plotter Sublimática', 25000, 10000, 60),
  ('Plotter recorte grande', 15000, 5000, 60),
  ('Plotter recorte mesa', 18000, 10000, 60),
  ('Crachá+Moveis+Outras', 55000, 5000, 60)) as t(n, p, r, m);
insert into public.productive_capacity (empresa_id, hours_per_month, production_employees) select id, 147, 5 from _emp;
select (select count(*) from public.monthly_expenses) as despesas, (select count(*) from public.salaries) as salarios, (select count(*) from public.equipment_depreciation) as equipamentos;
commit;
