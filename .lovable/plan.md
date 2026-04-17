
## Diagnóstico

Há 4 sites com `nome_produto = "...4x4 cor"` mas todos vinculados ao canônico **"4x0 cor"** (id `5539b6ac...`). O canônico **"4x4 cor"** (id `d50285a1...`) recém criado existe mas tem 0 sites vinculados — por isso não aparece no filtro nem agrupa nada.

Causa raiz: quando esses sites foram cadastrados, a função `findOrCreateCatalogo` usa `productKey()` que **remove tokens "4x4" e "4x0"** (regex `/^\d+x\d+$/` os trata como dimensão e descarta), então "4x4 cor" e "4x0 cor" geram a MESMA chave e foram vinculados ao mesmo canônico.

## Plano

**Passo 1 — Corrigir os vínculos (data fix imediato):**
Atualizar os 4 sites cujo `nome_produto` contém "4x4" para apontarem ao canônico correto `d50285a1-8f3c-488b-b6cc-f4d1f8b65363`.

```sql
UPDATE sites_monitorados
SET produto_catalogo_id = 'd50285a1-8f3c-488b-b6cc-f4d1f8b65363'
WHERE nome_produto ILIKE '%4x4 cor%'
  AND produto_catalogo_id = '5539b6ac-6078-486d-9517-0a23ca774f74';
```

**Passo 2 — Corrigir `productKey` em `src/lib/produtoCatalogo.ts`** para que `"4x4"` e `"4x0"` (cor/lados de impressão) NÃO sejam tratados como dimensão e fiquem como tokens distintos. Hoje o regex `/^\d+x\d+$/` descarta ambos. Solução: só tratar como dimensão quando os números forem ≥ 5 (cores são 1x0/4x0/4x4/1x1) — ou manter explicitamente esses tokens no key.

Ajuste no filtro de tokens:
```ts
.filter((t) => t && !STOPWORDS.has(t)
  && !/^\d+(g|cm|mm)?$/.test(t)
  && !/^([1-4])x([0-4])$/.test(t)  // mantém 4x4/4x0/1x1 como token (cor)
  && !/^\d{2,3}x\d{2,3}$/.test(t)) // só descarta dimensões grandes (10x14, 20x30...)
```

Isso garante que futuros cadastros não confundam variantes de cor.

**Passo 3 — Recarregar a página** para o filtro mostrar o canônico "4x4 cor" com seus 4 sites.

## Resultado esperado

- Filtro "Produto" do Monitoramento passa a listar **ambas** as variantes (4x0 cor e 4x4 cor) separadamente.
- Comparativos por fornecedor passam a separar corretamente impressão 1 cor × 4 cores.
- Cadastros futuros de novas cores não vão se misturar.
