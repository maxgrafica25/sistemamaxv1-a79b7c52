-- Backfill: criar entradas em produtos_catalogo para sites_monitorados sem vínculo
-- e atribuir o produto_catalogo_id correspondente.
-- Para cada nome_produto único sem vínculo, cria 1 entrada no catálogo
-- e vincula todos os sites com esse mesmo nome_produto.

DO $$
DECLARE
  rec RECORD;
  new_catalogo_id uuid;
BEGIN
  FOR rec IN
    SELECT DISTINCT nome_produto, categoria
    FROM public.sites_monitorados
    WHERE produto_catalogo_id IS NULL
      AND nome_produto IS NOT NULL
      AND trim(nome_produto) <> ''
  LOOP
    -- Tenta encontrar produto existente com mesmo nome_canonico (case-insensitive)
    SELECT id INTO new_catalogo_id
    FROM public.produtos_catalogo
    WHERE lower(trim(nome_canonico)) = lower(trim(rec.nome_produto))
    LIMIT 1;

    -- Se não existe, cria
    IF new_catalogo_id IS NULL THEN
      INSERT INTO public.produtos_catalogo (nome_canonico, categoria)
      VALUES (rec.nome_produto, NULLIF(lower(trim(rec.categoria)), ''))
      RETURNING id INTO new_catalogo_id;
    END IF;

    -- Vincula todos os sites com esse nome ao produto do catálogo
    UPDATE public.sites_monitorados
    SET produto_catalogo_id = new_catalogo_id
    WHERE produto_catalogo_id IS NULL
      AND nome_produto = rec.nome_produto;
  END LOOP;
END $$;