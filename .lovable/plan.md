# Coluna 380px + subtítulo padronizado

## 1. Largura da coluna

Em `src/components/orcamentos-v3/NewQuoteFormV3.tsx`:

```
lg:grid-cols-[1fr_380px]
```

(sem variação em `xl`, conforme pedido)

## 2. Subtítulo padronizado dos cards

Em `src/components/orcamentos-v3/cart/UnifiedCart.tsx`, função `itemSubtitle`:

**Hoje (print):** `5 folhas | Couche 300g | Frente`
**Novo (print):** `Couche 300g | Frente | Laminação fosca`

Mudanças:
- **`print`** — remover `N folhas`. Manter `papel + gramatura` e `Frente/Frente-Verso`. Acrescentar nomes dos acabamentos selecionados (`finishings` ou `finishing_selections[].name`) ao final, separados por `|`.
- **`booklet`** — remover `N folhas`. Manter `papel + gramatura`, `Frente`/`Frente-Verso`, e acrescentar `finishings`.
- **`label`** — manter dimensões + papel/gramatura (já estão corretos). Acrescentar `finishings` se houver.
- **`cv`** — manter dimensões + mídia + impressão. Acrescentar acabamentos pelo nome (`finishings` legado ou ignorar IDs sem nome resolvido).
- **`booklet/labor/third/supply`** — sem mudança além das já citadas.

Sobre "ao lado dos cartões de visita tá mencionando couchê": o subtítulo no screenshot mostrava `5 folhas | Couche 300g | Frente`, padrão de `print` (e não `cv`). Como o título já carrega o nome do produto, o subtítulo passa a ser **apenas características de produção**: tipo de papel, gramatura, frente/verso e acabamentos.

## Arquivos

- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (grid)
- `src/components/orcamentos-v3/cart/UnifiedCart.tsx` (`itemSubtitle`)
