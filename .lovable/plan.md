# Fase C — Faixas persistidas no orçamento

Objetivo: o usuário clica em **"Adicionar todas como faixas"** dentro do simulador e o orçamento passa a tratar essas N quantidades como **um produto só com várias opções de preço** — visível no carrinho, no save e no PDF que vai pro cliente.

## 1. Schema (migration)

Adicionar coluna `tier_group_id text NULL` em:
- `quote_materials` (cobre print, booklet, supply, label)
- `quote_third_party`
- `cv_quote_items`

Índice composto `(quote_id, tier_group_id)` em cada uma para o agrupamento no viewer ser barato. Sem mudança de RLS — herda das policies existentes.

## 2. Tipos (`types.ts`)

Adicionar campo opcional em todos os `V3*Item`:
```ts
tier_group_id?: string | null;
```
Default `undefined` = item solto (comportamento atual, zero impacto em itens já criados).

## 3. Simulador (`TierSimulator.tsx`)

Adicionar uma segunda ação no popover:
- Botão **"➕ Adicionar todas como faixas"** abaixo da tabela.
- Recebe nova prop `onCloneAsTiers?: (qtys: number[]) => void` (opcional — se ausente, esconde o botão).
- Ao clicar: gera um `tier_group_id` único (`tg_<id>`) e dispara a callback com a lista atual de quantidades.

A ação **"Usar esta"** continua igual (substitui a qty no item atual, sem grupo).

## 4. Forms

Cada form (Print, CV, Booklet, Label, Supply, Third) ganha um novo prop opcional `onAddTiers?: (items: V3Item[]) => void` e passa para o `TierSimulator` um handler que:

1. Para cada `qty` da lista, monta o `V3Item` igual ao "Adicionar" normal, mas com `quantidade = qty` e `tier_group_id` compartilhado.
2. Chama `onAddTiers(items)`.

Em CV/Booklet/Label onde o cálculo é mais complexo, a função-fábrica já existe internamente — só precisamos extrair para reaproveitar com qty variável.

## 5. NewQuoteFormV3

Já tem `addItems(list)`. Só repassar como `onAddTiers={addItems}` para cada form.

## 6. UnifiedCart — agrupamento visual

Antes de renderizar, agrupar `items` por `tier_group_id`:
- Itens sem grupo: renderizam normal.
- Itens com grupo: aparecem como **um card único** com:
  - Cabeçalho: descrição do primeiro item + badge "Faixas (N)"
  - Sub-linhas: `100 un · R$ X,XX (R$ Y,YY/un)` para cada faixa, com botão de remover por linha.
  - Botão "Excluir grupo" remove todos os irmãos.

Editar a descrição de um item do grupo propaga aos irmãos (mesma produção, só muda qtd).

## 7. saveQuoteV3

Repassar `tier_group_id` em todos os inserts (`quote_materials`, `quote_third_party`, `cv_quote_items`). Sem outras mudanças — itens continuam linhas independentes no DB, ligadas pelo `tier_group_id`.

## 8. ClientViewer (PDF/web do cliente)

Em `src/pages/orcamentos-v2/ClientViewer.tsx`:
- Após carregar `materials`, agrupar por `tier_group_id`.
- Para cada grupo, renderizar **uma linha de produto** com uma mini-tabela de faixas:

```text
Banner Lona 90×120cm — Alta resolução
┌────────┬───────────┬────────────┐
│ Qtd    │ Total     │ Unitário   │
├────────┼───────────┼────────────┤
│ 100    │ R$ 540,00 │ R$ 5,40    │
│ 250    │ R$ 1.250  │ R$ 5,00    │
│ 500    │ R$ 2.350  │ R$ 4,70    │
└────────┴───────────┴────────────┘
```

- O fluxo de "aprovar item" precisa permitir que o cliente escolha **uma faixa** do grupo (radio em vez de checkbox), e os irmãos não-escolhidos são ignorados na aprovação.
- Tracking (`item_selected`) passa a registrar também `tier_qty` para análise.

## 9. Fora de escopo desta fase
- PDF gerado server-side (se existir um) — fica para depois, mesma lógica de agrupamento.
- Edição/adição de faixas em um orçamento já salvo (`EditQuoteV2`) — agora só *criação* lida com tier_group_id; edição mantém grupos mas não permite remontar.
- Desconto automático por faixa.

## Entrega
1 PR único cobrindo migration + types + simulator + forms + cart + save + viewer. Sem mudança no fluxo de itens soltos.

---

Posso seguir? Vou começar pela **migration** (precisa da sua aprovação) e na sequência o código.
