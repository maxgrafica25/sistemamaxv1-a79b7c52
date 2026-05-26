ALTER TABLE public.printing_price_items
ADD COLUMN IF NOT EXISTS fv_exception boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.printing_price_items.fv_exception IS
'Quando true, este item (cadastrado como "Frente") aparece também quando o usuário escolhe F/V no orçamento. Útil para papéis como Sulfite 75g A4 usados em frente e verso sob demanda.';