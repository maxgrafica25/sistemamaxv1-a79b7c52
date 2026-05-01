-- 1. Adicionar coluna parent_item_id em quote_materials (auto-referência)
ALTER TABLE public.quote_materials
  ADD COLUMN parent_item_id uuid NULL
  REFERENCES public.quote_materials(id) ON DELETE CASCADE;

-- 2. Adicionar coluna parent_item_id em quote_labor_steps (referência a item de impressão)
ALTER TABLE public.quote_labor_steps
  ADD COLUMN parent_item_id uuid NULL
  REFERENCES public.quote_materials(id) ON DELETE CASCADE;

-- 3. Índices para performance ao buscar filhos por pai
CREATE INDEX IF NOT EXISTS idx_quote_materials_parent
  ON public.quote_materials(parent_item_id)
  WHERE parent_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_quote_labor_steps_parent
  ON public.quote_labor_steps(parent_item_id)
  WHERE parent_item_id IS NOT NULL;

-- 4. Coluna de observações gerais do orçamento
ALTER TABLE public.quotes
  ADD COLUMN notes text NULL;

-- 5. Estender approve_quote_items para propagar aprovação para filhos vinculados
CREATE OR REPLACE FUNCTION public.approve_quote_items(p_quote_id uuid, p_item_ids uuid[])
RETURNS TABLE(approved_count integer, total_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_quote_locked boolean;
  v_count integer;
  v_total numeric;
BEGIN
  SELECT is_locked INTO v_quote_locked
    FROM public.quotes
   WHERE id = p_quote_id;

  IF v_quote_locked IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  IF v_quote_locked THEN
    RAISE EXCEPTION 'Este orçamento foi substituído por uma nova versão.';
  END IF;

  IF p_item_ids IS NULL OR array_length(p_item_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Nenhum item selecionado.';
  END IF;

  -- Aprova os itens pais selecionados (somente pendentes do mesmo orçamento)
  UPDATE public.quote_materials
     SET status = 'aprovado'
   WHERE quote_id = p_quote_id
     AND id = ANY(p_item_ids)
     AND status = 'pendente';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- CASCATA: aprova materiais filhos vinculados aos pais aprovados
  UPDATE public.quote_materials
     SET status = 'aprovado'
   WHERE quote_id = p_quote_id
     AND parent_item_id = ANY(p_item_ids)
     AND status = 'pendente';

  -- Recalcula total aprovado (apenas itens raiz; filhos já estão embutidos no preço do pai)
  SELECT COALESCE(SUM(approved_value), 0) INTO v_total
    FROM public.quote_materials
   WHERE quote_id = p_quote_id
     AND status = 'aprovado'
     AND parent_item_id IS NULL;

  -- Atualiza status global do orçamento
  UPDATE public.quotes q
     SET status = CASE
       WHEN NOT EXISTS (
         SELECT 1 FROM public.quote_materials
          WHERE quote_id = q.id AND status = 'pendente'
       ) AND EXISTS (
         SELECT 1 FROM public.quote_materials
          WHERE quote_id = q.id AND status = 'aprovado'
       ) THEN 'approved'
       WHEN EXISTS (
         SELECT 1 FROM public.quote_materials
          WHERE quote_id = q.id AND status = 'aprovado'
       ) THEN 'partial'
       ELSE q.status
     END,
     updated_at = now()
   WHERE id = p_quote_id;

  RETURN QUERY SELECT v_count, v_total;
END;
$function$;