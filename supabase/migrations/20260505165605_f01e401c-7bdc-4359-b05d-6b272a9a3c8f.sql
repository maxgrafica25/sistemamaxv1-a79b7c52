-- Standardize product/service nomenclature in quotes
ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS catalog_source text,
  ADD COLUMN IF NOT EXISTS catalog_item_id uuid;

-- Unique index on lowercase name for printing catalog (only active items, paper+grammage+size+side+printer combo identifies it
-- but we want to prevent admins creating duplicate "names": for finishings name is the human label).
CREATE UNIQUE INDEX IF NOT EXISTS finishings_price_items_lower_name_uniq
  ON public.finishings_price_items (lower(name));

-- Validation + canonical-name normalization trigger for quote_materials.
CREATE OR REPLACE FUNCTION public.validate_quote_material_catalog()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_parent_quote uuid;
  v_parent_source text;
BEGIN
  IF NEW.catalog_source IS NULL THEN
    RETURN NEW; -- legacy / freeform rows allowed
  END IF;

  IF NEW.catalog_source = 'printing' THEN
    SELECT trim(coalesce(paper_type,'') || ' ' || coalesce(grammage,'') || ' ' || coalesce(size,'') || ' ' || coalesce(side,''))
      INTO v_name
      FROM public.printing_price_items
      WHERE id = NEW.catalog_item_id;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Item de impressão (%) não encontrado no catálogo.', NEW.catalog_item_id;
    END IF;
    NEW.description := v_name;

  ELSIF NEW.catalog_source = 'finishing' THEN
    SELECT name INTO v_name FROM public.finishings_price_items WHERE id = NEW.catalog_item_id;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Acabamento (%) não encontrado no catálogo.', NEW.catalog_item_id;
    END IF;
    IF NEW.parent_item_id IS NULL THEN
      RAISE EXCEPTION 'Acabamento precisa estar vinculado a um item de impressão (parent_item_id).';
    END IF;
    SELECT quote_id, catalog_source INTO v_parent_quote, v_parent_source
      FROM public.quote_materials WHERE id = NEW.parent_item_id;
    IF v_parent_quote IS NULL OR v_parent_quote <> NEW.quote_id THEN
      RAISE EXCEPTION 'Pai do acabamento precisa pertencer ao mesmo orçamento.';
    END IF;
    NEW.description := v_name;

  ELSE
    RAISE EXCEPTION 'catalog_source inválido: %', NEW.catalog_source;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quote_material_catalog ON public.quote_materials;
CREATE TRIGGER trg_validate_quote_material_catalog
  BEFORE INSERT OR UPDATE ON public.quote_materials
  FOR EACH ROW EXECUTE FUNCTION public.validate_quote_material_catalog();