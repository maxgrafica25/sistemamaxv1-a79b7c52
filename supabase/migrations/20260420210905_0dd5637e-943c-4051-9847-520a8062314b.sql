CREATE OR REPLACE FUNCTION public.detectar_duplicatas_categorias(
  _origem text,
  _destino text
)
RETURNS TABLE (
  fornecedor text,
  produto text,
  origem_count bigint,
  destino_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(NULLIF(btrim(MAX(fornecedor_nome)), ''), '(sem fornecedor)') AS fornecedor,
    COALESCE(NULLIF(btrim(MAX(nome_produto)), ''), '(sem produto)')       AS produto,
    COUNT(*) FILTER (WHERE categoria = _origem)  AS origem_count,
    COUNT(*) FILTER (WHERE categoria = _destino) AS destino_count
  FROM public.sites_monitorados
  WHERE categoria IN (_origem, _destino)
  GROUP BY lower(btrim(COALESCE(fornecedor_nome, ''))), lower(btrim(COALESCE(nome_produto, '')))
  HAVING COUNT(*) FILTER (WHERE categoria = _origem)  > 0
     AND COUNT(*) FILTER (WHERE categoria = _destino) > 0
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.detectar_duplicatas_categorias(text, text) TO authenticated;