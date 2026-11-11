-- Lona sem impressão para terceirizado (decidido com o Juliano em 03/11/2026).
-- Cobra sempre pela largura do rolo (190 cm) × comprimento, para cobrir a sobra do corte.
-- Custo/m² de rolo: lona 440 g R$ 8,60 + frete R$ 0,63 (R$ 60 ÷ 95 m² do rolo) + corte ~R$ 0,80 ≈ R$ 10,00.
-- Venda: R$ 20,00/m² (venda sem nota, no Pix ou dinheiro).
ALTER TABLE public.cv_calc_midias ADD COLUMN IF NOT EXISTS largura_rolo_cm numeric;

DO $$
DECLARE
  emp uuid := (SELECT id FROM public.empresas WHERE nome = 'Max Gráfica' LIMIT 1);
BEGIN
  IF emp IS NULL THEN RETURN; END IF;
  INSERT INTO public.cv_calc_midias (empresa_id, nome, tipo_midia, custo_mt2, lucro_mt2, custo_fixo, lucro_fixo, largura_rolo_cm, sort_order)
  SELECT emp, 'Lona Sem Impressão (Terceirizado)', 'lona', 10.00, 10.00, 0, 0, 190, 50
  WHERE NOT EXISTS (
    SELECT 1 FROM public.cv_calc_midias x WHERE x.nome = 'Lona Sem Impressão (Terceirizado)' AND x.empresa_id = emp
  );
END $$;
