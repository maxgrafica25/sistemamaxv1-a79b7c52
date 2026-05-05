
CREATE OR REPLACE FUNCTION public.validate_quote_material_catalog()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  v_name text;
  v_parent_quote uuid;
BEGIN
  IF NEW.catalog_source IS NULL THEN
    RETURN NEW;
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
    -- legado: ainda permitido para registros antigos, mas validamos
    SELECT name INTO v_name FROM public.finishings_price_items WHERE id = NEW.catalog_item_id;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Acabamento (%) não encontrado no catálogo.', NEW.catalog_item_id;
    END IF;
    IF NEW.parent_item_id IS NULL THEN
      RAISE EXCEPTION 'Acabamento precisa estar vinculado a um item de impressão (parent_item_id).';
    END IF;
    SELECT quote_id INTO v_parent_quote FROM public.quote_materials WHERE id = NEW.parent_item_id;
    IF v_parent_quote IS NULL OR v_parent_quote <> NEW.quote_id THEN
      RAISE EXCEPTION 'Pai do acabamento precisa pertencer ao mesmo orçamento.';
    END IF;
    NEW.description := v_name;

  ELSIF NEW.catalog_source = 'production_step' THEN
    SELECT description INTO v_name FROM public.production_steps WHERE id = NEW.catalog_item_id;
    IF v_name IS NULL THEN
      RAISE EXCEPTION 'Processo (%) não encontrado no catálogo de Processos de Produção.', NEW.catalog_item_id;
    END IF;
    NEW.description := v_name;

  ELSE
    RAISE EXCEPTION 'catalog_source inválido: %', NEW.catalog_source;
  END IF;

  RETURN NEW;
END;
$function$;
