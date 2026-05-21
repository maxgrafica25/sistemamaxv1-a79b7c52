## Tiers por quantidade nos acabamentos do Print V3

Hoje o Print V3 cobra sempre o `price_per_sheet` base do acabamento, ignorando as faixas cadastradas em `finishing_price_tiers` (que a Calc Etiquetas já respeita via `sheet-pricing.ts`). O resultado: orçamentos de tiragem grande ficam mais caros do que deveriam, e o cadastro de tiers fica invisível para o engine de impressão.

Esta fase fecha essa lacuna sem mexer em UI nem em catálogo — só no caminho de dados e no cálculo.

### 1. Carregar tiers junto com os acabamentos

`src/lib/finishings/catalog.ts` → estender `FinishingItem` com `tiers?: FinishingTier[]` e fazer o `select` da `listFinishings` puxar a relação aninhada:

```ts
.select("*, finishing_price_tiers(id, finishing_id, label, min_qty, max_qty, price_per_sheet, sort_order)")
```

Mapear o resultado para `tiers` no objeto retornado (mesmo padrão que `sheet-pricing.ts` já usa). Acabamentos sem tier vêm com `tiers: []` → comportamento atual preservado.

### 2. Resolver preço efetivo por folha no PrintForm

`src/components/orcamentos-v3/forms/PrintForm.tsx` → no `useMemo` de `selections`, em vez de mandar `price: f.price_per_sheet` cru, resolver pela quantidade atual usando `resolveFinishingPricePerSheet(f.price_per_sheet, f.tiers ?? [], quantidade)`.

Detalhes:
- `per_sheet` → snapshot do preço já com tier aplicado para `quantidade`
- `per_unit` → tier não se aplica (faixa é por folhas, não por unidades de ilhós/dobra); mantém `price_per_sheet` base
- Snapshot continua sendo o que vai para `finishing_selections` no item — então o item salvo carrega o preço efetivo daquela tiragem, independente de mudanças futuras nas tiers

Em `buildItem(qty, tierGroupId?)` (usado pelo TierSimulator com `qty` diferente da atual), recalcular `selections` localmente com o `qty` do tier para que cada faixa da simulação use a tier correta de cada acabamento. Hoje o `useMemo` está atrelado a `quantidade` — preciso extrair um helper `buildSelections(qty)` e chamá-lo tanto no `useMemo` quanto dentro de `buildItem`.

### 3. Hint visual no chip

`FINISHES_PADRAO` mostra hoje "a partir de R$ X,XX/folha". Quando o acabamento tem tiers e a `quantidade` atual cai em uma tier mais barata, o hint atual fica confuso (mostra preço base, mas o cálculo usa outro). Atualizar `hint` para refletir o preço efetivo da `quantidade` atual:

```
per_sheet sem tier:  "R$ 0,30/folha"
per_sheet com tier:  "R$ 0,20/folha (faixa 100-499)"
per_unit:            "R$ 1,50/un"
```

### 4. Tests

Adicionar em `src/test/v3-print-finishings.test.ts`:
- per_sheet com tier que cobre a qty → usa preço da tier
- per_sheet com tier que NÃO cobre (qty abaixo do menor min_qty) → usa primeira tier
- per_sheet sem nenhuma tier → fallback para preço base
- per_unit ignora tiers (mantém base) mesmo se houver tiers cadastradas
- Selections em qty diferentes (simulando tier simulator) resolvem preço independente

### 5. Fora de escopo

- UI de cadastro de tiers (já existe em Acabamentos via `FinishingTiersDrawer`)
- Tiers para `per_unit` (faixa por unidade de ilhós não faz sentido prático hoje)
- Lona/banner — segue com chips hardcoded sem tier
- Calc Etiquetas — já usa tiers via outro caminho, não muda nada

### Arquivos

- `src/lib/finishings/catalog.ts` — estender tipo + select aninhado
- `src/components/orcamentos-v3/forms/PrintForm.tsx` — extrair `buildSelections(qty)`, aplicar `resolveFinishingPricePerSheet`, atualizar `hint`
- `src/test/v3-print-finishings.test.ts` — novos casos

### Risco

Baixo. O snapshot em `finishing_selections` blinda orçamentos salvos. Acabamentos sem tier mantêm comportamento atual byte-a-byte. A única mudança visível é: tiragens grandes ficam mais baratas quando o acabamento tem faixa cadastrada — exatamente o efeito desejado.
