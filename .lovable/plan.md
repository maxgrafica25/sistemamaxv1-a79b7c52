

# Detectar duplicatas via SQL agregado (server-side)

Hoje `detectDuplicates` em `GerenciarCategoriasDialog.tsx` faz `SELECT id, fornecedor_nome, nome_produto, categoria` das **duas categorias inteiras** e agrupa no JS. A cada merge, transferimos N+M linhas pelo wire só para descartar 99%.

## Solução: RPC com `GROUP BY ... HAVING`

### 1) Função SQL (migration)

```sql
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
    COALESCE(NULLIF(btrim(fornecedor_nome), ''), '(sem fornecedor)') AS fornecedor,
    COALESCE(NULLIF(btrim(nome_produto), ''), '(sem produto)')       AS produto,
    COUNT(*) FILTER (WHERE categoria = _origem)  AS origem_count,
    COUNT(*) FILTER (WHERE categoria = _destino) AS destino_count
  FROM public.sites_monitorados
  WHERE categoria IN (_origem, _destino)
  GROUP BY 1, 2
  HAVING COUNT(*) FILTER (WHERE categoria = _origem)  > 0
     AND COUNT(*) FILTER (WHERE categoria = _destino) > 0
  ORDER BY 1, 2;
$$;

GRANT EXECUTE ON FUNCTION public.detectar_duplicatas_categorias(text, text)
  TO authenticated;
```

Notas:
- Agrupa pela mesma chave normalizada usada hoje (`lower+trim`) — refinamento: usar `lower(btrim(...))` para casar com o JS atual:
  ```sql
  GROUP BY lower(btrim(fornecedor_nome)), lower(btrim(nome_produto))
  ```
  e selecionar `MAX(...)` para o nome de exibição. Mantém comportamento idêntico ao client-side.
- `HAVING` garante que só linhas presentes nas **duas** categorias voltem — zero filtragem no front.
- `SECURITY DEFINER` + `STABLE`: leitura segura, respeita o GRANT explícito.

### 2) Atualizar `detectDuplicates` em `src/components/monitoramento/GerenciarCategoriasDialog.tsx`

Substituir a query + agregação JS por uma única chamada RPC:

```ts
const detectDuplicates = async (origem: string, destino: string): Promise<DuplicateGroup[]> => {
  const { data, error } = await supabase.rpc("detectar_duplicatas_categorias", {
    _origem: origem,
    _destino: destino,
  });
  if (error) {
    toast.error("Erro ao verificar duplicatas: " + error.message);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    fornecedor: r.fornecedor,
    produto: r.produto,
    origemCount: Number(r.origem_count),
    destinoCount: Number(r.destino_count),
  }));
};
```

Remove o `Map`, o `norm()` e o loop de agregação — tudo já vem pronto do banco.

## Ganhos

- Tráfego: O(duplicatas) em vez de O(sites_origem + sites_destino).
- CPU client: zero agregação.
- Escala linear no banco (índice `categoria` já ajuda; se precisar, criar `CREATE INDEX ON sites_monitorados (categoria)` em migration futura).
- Comportamento funcional idêntico — UI de confirmação de merge não muda.

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Migration | criar função `public.detectar_duplicatas_categorias(text, text)` + GRANT |
| Editar | `src/components/monitoramento/GerenciarCategoriasDialog.tsx` (substituir corpo de `detectDuplicates` por `supabase.rpc(...)`) |

## Resultado esperado

- Merge de categoria com 10.000 sites cadastrados retorna apenas as N duplicatas reais (em milissegundos), sem baixar os 10.000 registros para o navegador.
- Toast e dialog de confirmação continuam funcionando exatamente como antes.

