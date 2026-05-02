## Problema

No popover de engajamento aparece **"Selecionou 5 unidades"** em um orçamento que tem **apenas 1 item**. A descrição do item é algo como "… 5 unidades" e está sendo logada como se fosse uma "opção" selecionada pelo cliente.

## Causa raiz

Em `src/pages/orcamentos-v2/ClientViewer.tsx` (função `toggleItem`, linhas 257–300), **toda vez que o cliente marca o checkbox de um item de aprovação parcial**, é disparado um evento `option_selected` com `option_label = item.description`.

Dois problemas se somam:

1. O evento é disparado mesmo quando o orçamento tem **apenas 1 item** — situação em que a "aprovação parcial" não faz sentido (o componente já oculta a UI parcial via `hasMultipleItems`, mas o `toggleItem` continua exposto e, se chamado, registra mesmo assim).
2. O texto exibido no timeline (`EngagementPopover.tsx` linha 70) é `"Selecionou {option_label}"`. Quando o `option_label` é a descrição do material (ex.: "Banner 90×120 — 5 unidades"), o texto truncado/contextual fica "Selecionou 5 unidades", confundindo o operador.

A intenção original do evento `option_selected` era rastrear escolha entre **opções A/B/C** (linha 186, no efeito de `selectedOptionId`), não o checkbox de itens individuais.

## Solução

Separar conceitualmente os dois rastreamentos e evitar registros sem sentido:

1. **Novo tipo de evento** `item_selected` / `item_deselected` (em `src/lib/quotes-v2/tracking.ts` no tipo `EngagementEventType`) para o checkbox de itens da aprovação parcial. Mantém `option_selected/deselected` exclusivo para escolha entre opções A/B/C.

2. **Em `ClientViewer.tsx` `toggleItem`**: 
   - Trocar os `trackEvent(..., "option_selected"/"option_deselected", ...)` por `"item_selected"/"item_deselected"`.
   - Adicionar guard: só registrar se `materials.length >= 2` (não faz sentido rastrear hesitação em item único).

3. **Em `src/lib/quotes-v2/temperature.ts`**: tratar os novos tipos no `buildStatsMap` (mesma lógica de hesitação atual, mas separada de "favoriteOption" — que deve permanecer apenas para opções A/B/C reais).

4. **Em `EngagementPopover.tsx` `eventLabel`**: 
   - `option_selected` continua: `Escolheu opção "{label}"`.
   - `item_selected` novo: `Marcou item "{label}"`.
   - `item_deselected` novo: `Desmarcou item "{label}"`.
   - Truncar `option_label`/`item_label` longos a ~40 chars com `…` para evitar quebras visuais estranhas.

5. **Insights ("Opção preferida" / "Dúvida no item")**: ajustar para usar `item_*` na seção "Dúvida no item" e `option_*` na seção "Opção preferida". Hoje ambas usam `option_*`, o que mistura semânticas.

6. **Compatibilidade retroativa**: eventos antigos no banco continuam com `event_type='option_selected'` e `option_label` = descrição do item. Para não quebrar a leitura do histórico, manter no `eventLabel` um fallback que detecte se o `option_label` parece ser uma descrição de item (heurística simples: se o orçamento atual não tem opções A/B/C, exibir como "Marcou item …"). Alternativa mais limpa: aceitar que registros antigos seguirão com o texto atual e o ajuste valerá só para novos eventos.

## Arquivos a editar

- `src/lib/quotes-v2/tracking.ts` — adicionar `item_selected` / `item_deselected` em `EngagementEventType`.
- `src/pages/orcamentos-v2/ClientViewer.tsx` — trocar tipos de evento em `toggleItem` e adicionar guard `materials.length >= 2`.
- `src/lib/quotes-v2/temperature.ts` — incluir novos tipos no agregador, separar de `favoriteOption`.
- `src/components/orcamentos-v2/EngagementPopover.tsx` — novos rótulos no `eventLabel`, truncamento e ajuste dos insights.

## Fora do escopo

- Migração / reescrita de eventos históricos no banco (registros antigos continuarão como estão).
- Mudança na lógica de cálculo de temperatura (cold/warm/hot/live).