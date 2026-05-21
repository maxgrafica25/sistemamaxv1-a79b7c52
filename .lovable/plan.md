# Faixas: destacar quantidade solicitada e marcar as demais como sugestões

Hoje, ao usar "Adicionar todas como faixas", todas as quantidades viram itens irmãos no mesmo bloco (`tier_group_id`), sem distinção entre a que o cliente pediu e as outras. Vou marcar a faixa correspondente à quantidade atual do form como **principal (Solicitada)** e as demais como **Sugestões**, mantendo tudo num único bloco visual.

## Mudanças

### 1. `types.ts`
Adicionar campo opcional `tier_primary?: boolean` em `V3BaseFields` (já existe `tier_group_id` lá). Assim todos os tipos de item herdam.

### 2. `TierSimulator.tsx`
- `onCloneAsTiers` passa a entregar `{ qtys: number[]; primaryQty: number }` em vez de só o array.
- `primaryQty` = `currentQty` se estiver entre as faixas, senão `qtys[0]`.

### 3. Forms que usam o simulador (`PrintForm`, `CVForm`, `ThirdPartyForm`, `SupplyForm`, `BookletForm`, `LabelEmbeddedForm`)
No callback `onCloneAsTiers`, marcar `tier_primary: q === primaryQty` no item gerado para cada quantidade. Sem mais nenhuma mudança de lógica.

### 4. `UnifiedCart.tsx` — render do grupo de faixas
No bloco existente `type: "group"`:

- Ordenar as faixas com a primária em primeiro lugar, demais em ordem crescente de quantidade.
- A linha primária recebe um chip pequeno **`Solicitada`** (variant default em `primary`), com a quantidade em destaque (text-sm, primary).
- Adicionar um separador sutil entre a linha primária e as demais, com um label **`Sugestões`** (text-[10px] uppercase muted) acima delas.
- Manter as colunas atuais (qtd, unitário, total, remover) e o botão "Excluir grupo".
- O título do grupo (cabeçalho com ícone) continua igual; o badge "Faixas (N)" continua.

Resultado visual aproximado:

```text
[📖]  Apostila 20fl Sulfite 75g                          Faixas (3)
      Comparativo de quantidades

      ──────────────────────────────────────────────
      [Solicitada]   5 un     R$ 98,02/un   R$ 490,10  🗑
      ──────────────────────────────────────────────
      Sugestões
       10 un     R$ 92,00/un   R$ 920,00  🗑
       20 un     R$ 88,40/un   R$ 1.768,00 🗑
      ──────────────────────────────────────────────
                                          [Excluir grupo]
```

## Persistência

`tier_primary` é só para exibição. Decisão: persistir junto com o item (vai num campo `tier_primary` no payload) para que ao reabrir o orçamento a marcação permaneça. Verificar `saveQuoteV3.ts` e o load correspondente; se houver um whitelist de colunas, incluir `tier_primary`. Se não couber sem migração, deixo só em memória (frontend) e cabe num próximo passo.

## Fora de escopo

- PDF do orçamento (mostrar "Solicitada" no PDF é um próximo passo, se quiser).
- Bundles "Apostila + Kit" combinados com faixas — não muda nada agora.
- Cálculo financeiro: soma continua somando todos os itens; se quiser que **só a faixa solicitada** entre no total e as sugestões não, é outra decisão — me avise.
