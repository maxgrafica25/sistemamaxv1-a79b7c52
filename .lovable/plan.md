## Objetivo

Tornar visualmente óbvio quando um orçamento "Parcial/Aprovado" recebeu uma nova aprovação de item ainda não vista — usando o padrão "email não lido" + barra de progresso segmentada no badge.

## Estado atual (reaproveitar)

- O conceito de "não lido" **já existe**: `quotes.last_partial_seen_at` vs `quote_materials.approved_at` mais recente. O `OrcamentosV2` já calcula `hasUnseen` por linha (em `statusBadge`, linha 68–70) e o `EditQuoteV2` já marca como visto ao abrir (`update last_partial_seen_at = now()`).
- Hoje esse `hasUnseen` só vira uma bolinha vermelha dentro do `QuoteStatusBadge`.
- O agregado `aggMap` já tem `{ approved, total, lastApprovedAt }` por orçamento.

Ou seja: **nenhuma mudança de schema, nenhuma migration, nenhuma alteração no gatilho de "marcar como lido"** — tudo já está no lugar.

## Mudanças (frontend apenas)

### 1. `src/components/orcamentos-v2/QuoteStatusBadge.tsx`

- Remover a bolinha vermelha (`hasUnseen` dot) de dentro do badge.
- Adicionar **barra segmentada** logo abaixo do texto quando `status === "partial" || status === "approved"` e `total > 0`:
  - `total` segmentos finos (≈ 4px de altura, gap de 2px), largura total = largura do badge.
  - Segmentos `0..approved-1` preenchidos com `bg-green-600` (cor de sucesso já usada no badge "Aprovado").
  - Segmentos restantes com `bg-muted`.
  - Se `total > 12`, cair para uma única `Progress` bar contínua para não ficar "serrilhado".
- Texto continua mostrando `Parcial (2/3)` / `Aprovado (3/3)`.
- Manter prop `hasUnseen` (será usada pela linha, não pelo badge), ou removê-la do badge — a lista passa a usar `hasUnseen` direto na `<tr>`.

### 2. `src/pages/orcamentos-v2/OrcamentosV2.tsx`

- Calcular `hasUnseen` por linha (mesma fórmula que já existe em `statusBadge`):
  ```ts
  const agg = aggMap.get(q.id);
  const hasUnseen =
    (q.status === "partial" || q.status === "approved") &&
    !!agg?.lastApprovedAt &&
    (!q.last_partial_seen_at ||
      new Date(agg.lastApprovedAt) > new Date(q.last_partial_seen_at));
  ```
- Aplicar na `<tr>`:
  - Background sutil quando `hasUnseen`: `bg-primary/5` (tom bem claro do roxo da marca, segue paleta) + manter `hover:bg-muted/50`.
  - Borda esquerda de 2px `border-l-2 border-l-primary` como reforço visual (igual ao padrão "email não lido").
- Aplicar nas células "Nº" e "Cliente":
  - Quando `hasUnseen` → `font-bold` (Nº) e `font-semibold` (cliente).
  - Caso contrário → manter pesos atuais (`font-medium` / normal).
- O clique na linha já navega para `/orcamentos-v2/:id`, que abre `EditQuoteV2`, que **já** dispara o update de `last_partial_seen_at`. O realtime de `quotes UPDATE` já está escutando e vai atualizar a linha em tempo real → background e bold somem automaticamente.

### 3. Sem mudanças

- `EditQuoteV2.tsx`: já marca como lido.
- `ClientViewer.tsx`: badge no header do cliente público continua só com fração (cliente nunca vê "não lido").
- Banco: nenhuma migration.

## Detalhes técnicos

- Cores via design tokens: `bg-primary/5`, `border-l-primary`, `bg-green-600` (já em uso no badge), `bg-muted`. Sem cores hardcoded fora da paleta.
- Barra segmentada: `<div class="flex gap-0.5 mt-1 h-1">` com N divs `flex-1 rounded-sm`.
- Acessibilidade: adicionar `aria-label` na `<tr>` quando `hasUnseen` ("Orçamento com nova aprovação não vista").
- Sem animação no destaque (conforme regra anterior — "sem animação").

## Arquivos tocados

- `src/components/orcamentos-v2/QuoteStatusBadge.tsx` (substitui dot por barra segmentada)
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` (destaque de linha + bold condicional)