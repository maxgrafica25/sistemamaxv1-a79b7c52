## Problema

Você tem um orçamento aberto, mas a lista continua mostrando "Frio" e os contadores de engajamento não atualizam sozinhos. Há dois motivos distintos:

### 1. Eventos da equipe interna são descartados (por design)
A função `register_quote_event` no banco tem esta regra:
```
IF v_uid IS NOT NULL THEN RETURN; END IF;
```
Ou seja, se quem abre a proposta está **logado no sistema** (você, Marcelle, etc.), nenhum evento é registrado — para não poluir as estatísticas reais dos clientes. Por isso, quando **você mesmo** abre `/p/2026-012`, o badge continua "Frio".

Isso é intencional e correto. Sugestão: validar abrindo a proposta numa **aba anônima** (sem login) ou em outro dispositivo — aí você verá o engajamento aparecer.

### 2. A lista NÃO atualiza engajamento em tempo real (bug real)
Em `src/pages/orcamentos-v2/OrcamentosV2.tsx` o `useEffect` de realtime escuta apenas a tabela `quotes`:

```ts
.on("postgres_changes", { event: "*", schema: "public", table: "quotes" }, () => fetchQuotes())
```

Quando um cliente real visualiza/baixa PDF/compartilha, a tabela `quote_engagement_events` recebe INSERTs, mas a página não recarrega o `statsMap` — então o badge "Frio/Quente/Online agora", contadores de views, "lida integralmente", etc. só atualizam ao dar F5. O `RealtimeRadar` mostra o toast 🔥, mas os badges da lista permanecem estáticos.

### 3. Eventos `item_selected`/`item_deselected` são rejeitados pelo banco
A whitelist da função aceita só:
`viewed, printed, whatsapp_share, link_copied, option_selected, option_deselected, scroll_depth`

Mas o app dispara também `item_selected` e `item_deselected` (usados no cálculo de "hesitação"). Esses eventos hoje retornam erro e nunca são gravados — o insight "Dúvida no item" nunca aparece.

## Plano de correção

1. **Realtime do engajamento na lista** — em `OrcamentosV2.tsx`, adicionar subscription a `quote_engagement_events` (INSERT). Para evitar refetch pesado a cada evento, fazer um refetch debounced (~1,5 s) que recarrega só os eventos (não os quotes), e atualiza `statsMap`.

2. **Atualizar `last_viewed_at` em tempo real** — o canal atual de `quotes` UPDATE já cobre isso, mas o `fetchQuotes()` completo é caro. Trocar por um patch local: ao receber UPDATE, mesclar campos do `payload.new` no estado em vez de refetch total.

3. **Liberar `item_selected` / `item_deselected` no RPC** — migration adicionando os dois tipos à whitelist da função `register_quote_event`, para que a hesitação por item passe a ser computada.

4. **Mensagem de UX** — não muda código, mas vou deixar registrado: para validar engajamento real, abrir a proposta deslogado (aba anônima). Sessões da equipe interna continuam sendo intencionalmente ignoradas.

## Arquivos afetados

- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — nova subscription em `quote_engagement_events` + patch local no UPDATE de `quotes`.
- `supabase/migrations/<novo>.sql` — atualizar whitelist do `register_quote_event` para incluir `item_selected` e `item_deselected`.

Sem alterações em `RealtimeRadar`, `EngagementPopover`, `temperature.ts` ou pricing.
