-- Acabamentos para terceirizados (04/11/2026). Preço = custo ÷ 0,62: tira imposto (10%) e cartão (7%)
-- da regra normal; mantém perda 5% + lucro 33% (markup_override_pct = 38).
-- Materiais (extra_cost_*): bastão 1,05 R$ 2,40 · 1,50 R$ 3,50 · 2,05 R$ 4,80 (estimado) · ponteira R$ 0,25 ·
-- cordinha R$ 0,50/banner (estimado) · fita dupla face 12 mm R$ 107 / 360 m = R$ 0,30/m ·
-- ilhós (R$ 145 + 45 frete)/1000 = R$ 0,19, a cada 30 cm = R$ 0,63/m · corda da bainha R$ 0,30/m (estimado).
-- Tempos (labor items) tirados das anotações do Juliano; ficam "Estimado" até ele medir e validar.
ALTER TABLE public.cv_calc_acabamento_labor_items
  ADD COLUMN IF NOT EXISTS validado boolean NOT NULL DEFAULT false;

DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
  ac record;
  novo uuid;
BEGIN
  IF emp IS NULL THEN RETURN; END IF;

  FOR ac IN
    SELECT * FROM (VALUES
      ('Banner até 1,05 m – bastão, cordinha e ponteiras (Terceirizado)', 'outro',        6.30, 0.00, 'banner', 200),
      ('Banner até 1,50 m – bastão, cordinha e ponteiras (Terceirizado)', 'outro',        8.50, 0.00, 'banner', 201),
      ('Banner até 2,05 m – bastão, cordinha e ponteiras (Terceirizado)', 'outro',       11.10, 0.00, 'banner', 202),
      ('Faixa – bastão nas laterais, cordinha e ponteiras (Terceirizado)', 'faixa',       6.30, 0.00, 'faixa',  203),
      ('Bainha e Ilhós a cada 30 cm (Terceirizado)',                      'bainha_ilhos', 0.00, 0.93, 'bainha', 204),
      ('Bainha com Corda e Ilhós a cada 30 cm (Terceirizado)',            'bainha_ilhos', 0.00, 1.23, 'bainha', 205)
    ) AS v(nome, familia, por_unidade, por_metro, tipo, ordem)
  LOOP
    CONTINUE WHEN EXISTS (SELECT 1 FROM public.cv_calc_acabamentos x WHERE x.nome = ac.nome AND x.empresa_id = emp);

    INSERT INTO public.cv_calc_acabamentos (empresa_id, nome, familia, tipos_midia_compativeis,
      pricing_mode, markup_override_pct, extra_cost_unidade, extra_cost_perimetro, sort_order)
    VALUES (emp, ac.nome, ac.familia, ARRAY['lona'], 'recipe', 38, ac.por_unidade, ac.por_metro, ac.ordem)
    RETURNING id INTO novo;

    INSERT INTO public.cv_calc_acabamento_labor_items (empresa_id, acabamento_id, descricao, time_minutes, consumo_tipo, consumo_qty, sort_order, validado)
    SELECT emp, novo, l.descricao, l.minutos, l.escala, 1, l.ordem, false
    FROM (VALUES
      ('banner', 'Refile (16 min por 10 m²)',                                   1.6, 'por_mt2',         0),
      ('banner', 'Bainha na máquina de solda (média de 17 banners)',            2.1, 'por_peca',        1),
      ('banner', 'Cortar bastão, cordinha, grampear e ponteiras (média de 17)', 2.8, 'por_peca',        2),
      ('faixa',  'Refile (16 min por 10 m²)',                                   1.6, 'por_mt2',         0),
      ('faixa',  'Bainha na máquina de solda',                                  2.1, 'por_peca',        1),
      ('faixa',  'Bastões nas laterais, cordinha e ponteiras (faixa 200×60)',   5.0, 'por_peca',        2),
      ('bainha', 'Refile (16 min por 10 m²)',                                   1.6, 'por_mt2',         0),
      ('bainha', 'Bainha com fita + ilhós a cada 30 cm (lona 920×80 em 120 min)', 5.4, 'por_perimetro_m', 1)
    ) AS l(tipo, descricao, minutos, escala, ordem)
    WHERE l.tipo = ac.tipo;
  END LOOP;
END $$;
