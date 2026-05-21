-- Unifica acabamentos: Etiquetas + Impressão V3
CREATE TYPE finishing_pricing_model AS ENUM ('per_sheet', 'per_unit');

ALTER TABLE public.finishings_price_items
  ADD COLUMN pricing_model finishing_pricing_model NOT NULL DEFAULT 'per_sheet',
  ADD COLUMN applies_to text[] NOT NULL DEFAULT ARRAY['etiqueta']::text[],
  ADD COLUMN unit_label text;

ALTER TABLE public.finishings_price_items ALTER COLUMN size DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_finishing_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ctx text;
BEGIN
  IF NEW.applies_to IS NULL OR array_length(NEW.applies_to, 1) IS NULL THEN
    RAISE EXCEPTION 'applies_to deve conter ao menos um contexto (etiqueta ou impressao).';
  END IF;

  FOREACH v_ctx IN ARRAY NEW.applies_to LOOP
    IF v_ctx NOT IN ('etiqueta','impressao') THEN
      RAISE EXCEPTION 'applies_to inválido: %. Use etiqueta ou impressao.', v_ctx;
    END IF;
  END LOOP;

  IF NEW.pricing_model = 'per_unit' THEN
    IF NEW.unit_label IS NULL OR btrim(NEW.unit_label) = '' THEN
      RAISE EXCEPTION 'Modelo "por unidade" exige o campo unit_label (ex.: ilhós, dobra).';
    END IF;
  ELSIF NEW.pricing_model = 'per_sheet' THEN
    IF NEW.size IS NULL OR btrim(NEW.size) = '' THEN
      RAISE EXCEPTION 'Modelo "por folha" exige o tamanho da folha (size).';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_finishing_item ON public.finishings_price_items;
CREATE TRIGGER trg_validate_finishing_item
  BEFORE INSERT OR UPDATE ON public.finishings_price_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_finishing_item();