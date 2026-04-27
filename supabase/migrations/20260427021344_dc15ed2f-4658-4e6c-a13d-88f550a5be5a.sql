
-- ============= FASE 1: Aprovação parcial com versionamento =============

-- 1) Adicionar campos em quote_materials
ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS approved_value numeric;

-- Validação de status válido (via trigger, não CHECK, pra futuro proofing)
CREATE OR REPLACE FUNCTION public.validate_quote_material_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pendente', 'aprovado', 'recusado') THEN
    RAISE EXCEPTION 'Status inválido: %. Use pendente, aprovado ou recusado.', NEW.status;
  END IF;

  -- Bloqueia rebaixar item já aprovado
  IF TG_OP = 'UPDATE' AND OLD.status = 'aprovado' AND NEW.status <> 'aprovado' THEN
    RAISE EXCEPTION 'Não é possível alterar o status de um item já aprovado. Crie uma nova versão do orçamento.';
  END IF;

  -- Carimba data e congela valor ao aprovar
  IF NEW.status = 'aprovado' AND (OLD.status IS DISTINCT FROM 'aprovado') THEN
    NEW.approved_at := now();
    NEW.approved_value := NEW.quantity * NEW.unit_price;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_quote_material_status ON public.quote_materials;
CREATE TRIGGER trg_validate_quote_material_status
  BEFORE INSERT OR UPDATE ON public.quote_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_quote_material_status();

-- 2) Adicionar campos em quotes
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_quote_id uuid REFERENCES public.quotes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_quotes_parent ON public.quotes(parent_quote_id);

-- 3) Backfill: itens de orçamentos já aprovados ficam aprovados
UPDATE public.quote_materials qm
   SET status = 'aprovado',
       approved_at = q.updated_at,
       approved_value = qm.quantity * qm.unit_price
  FROM public.quotes q
 WHERE qm.quote_id = q.id
   AND q.status = 'approved'
   AND qm.status = 'pendente';

-- 4) RPC: cliente anônimo aprova itens selecionados
-- SECURITY DEFINER porque a página pública é anon. Validações garantem segurança.
CREATE OR REPLACE FUNCTION public.approve_quote_items(
  p_quote_id uuid,
  p_item_ids uuid[]
)
RETURNS TABLE(approved_count integer, total_value numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_quote_locked boolean;
  v_count integer;
  v_total numeric;
BEGIN
  -- Verifica se o orçamento existe e não está travado
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

  -- Aprova somente itens pendentes que pertencem ao orçamento
  UPDATE public.quote_materials
     SET status = 'aprovado'
   WHERE quote_id = p_quote_id
     AND id = ANY(p_item_ids)
     AND status = 'pendente';

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Recalcula total aprovado
  SELECT COALESCE(SUM(approved_value), 0) INTO v_total
    FROM public.quote_materials
   WHERE quote_id = p_quote_id
     AND status = 'aprovado';

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
$$;

-- 5) RPC: criar nova versão do orçamento
CREATE OR REPLACE FUNCTION public.create_quote_version(p_quote_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_quote public.quotes%ROWTYPE;
  v_new_id uuid;
  v_new_version integer;
  v_new_number text;
BEGIN
  -- Apenas admins podem criar nova versão
  IF NOT public.is_profile_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas administradores podem criar nova versão de orçamento.';
  END IF;

  SELECT * INTO v_old_quote FROM public.quotes WHERE id = p_quote_id;
  IF v_old_quote.id IS NULL THEN
    RAISE EXCEPTION 'Orçamento não encontrado.';
  END IF;

  v_new_version := v_old_quote.version + 1;

  -- Cria novo orçamento como cópia
  INSERT INTO public.quotes (
    quote_number, client, product, value, status, date, validity,
    discount_value, discount_type, payment_method, options,
    version, parent_quote_id, profit_margin
  ) VALUES (
    v_old_quote.quote_number,
    v_old_quote.client,
    v_old_quote.product,
    v_old_quote.value,
    'pending',
    CURRENT_DATE,
    v_old_quote.validity,
    v_old_quote.discount_value,
    v_old_quote.discount_type,
    v_old_quote.payment_method,
    v_old_quote.options,
    v_new_version,
    p_quote_id,
    v_old_quote.profit_margin
  )
  RETURNING id INTO v_new_id;

  -- Copia itens herdando o status (aprovados continuam aprovados)
  INSERT INTO public.quote_materials (
    quote_id, description, quantity, unit_price, sort_order,
    status, approved_at, approved_value
  )
  SELECT v_new_id, description, quantity, unit_price, sort_order,
         status, approved_at, approved_value
    FROM public.quote_materials
   WHERE quote_id = p_quote_id;

  -- Copia etapas de mão de obra
  INSERT INTO public.quote_labor_steps (quote_id, description, time_minutes, sort_order)
  SELECT v_new_id, description, time_minutes, sort_order
    FROM public.quote_labor_steps
   WHERE quote_id = p_quote_id;

  -- Trava o orçamento original
  UPDATE public.quotes
     SET is_locked = true, updated_at = now()
   WHERE id = p_quote_id;

  RETURN v_new_id;
END;
$$;
