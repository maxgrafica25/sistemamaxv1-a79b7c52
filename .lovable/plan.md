## Objetivo

Tornar o status "Parcial" mais informativo, sem poluir a interface:

1. **Badge mostra progresso em fração** — `Parcial (2/5)` em vez de só `Parcial`.
2. **Dot de notificação** (bolinha sólida, sem animação) no canto do badge quando houver aprovação parcial nova ainda não vista pela equipe. Some assim que alguém da equipe abrir o orçamento.

Aplica em **dois lugares**:
- Lista `/orcamentos-v2` (tabela)
- Header do `ClientViewer` (apenas a fração — sem dot, pois o dot só faz sentido para a equipe interna)

---

## Como funciona o "novo / não visto"

Adicionar coluna `last_partial_seen_at TIMESTAMPTZ` na tabela `quotes`.

- Quando o RPC `approve_quote_items` registra novas aprovações, **não toca** nessa coluna (mantém o "novo").
- Quando um usuário **autenticado** (equipe) abre o orçamento na rota interna `/orcamentos-v2/:id` (EditQuoteV2), atualiza `last_partial_seen_at = now()`.
- Dot aparece quando: `status IN ('partial','approved')` **E** existe algum `cv_quote_items.approved_at > coalesce(last_partial_seen_at, '-infinity')`.

A fração `aprovados/total` é calculada a partir dos `cv_quote_items` já carregados (`status = 'approved'` vs total de itens raiz).

---

## Mudanças técnicas

### Migration
- `ALTER TABLE quotes ADD COLUMN last_partial_seen_at TIMESTAMPTZ;`
- Sem alteração no `approve_quote_items` (já entrega a notificação no inbox).

### `OrcamentosV2.tsx` (lista)
- No `loadQuotes`, trazer também o agregado de itens por orçamento: contagem total e aprovados, e `max(approved_at)`. Solução simples: um segundo `select` em `cv_quote_items` filtrado pelos IDs da página, agrupando em memória (já é o padrão do projeto).
- Substituir `statusBadge(status)` por `statusBadge(status, { approved, total, hasUnseen })`.
- Renderização do badge `Parcial`:
  ```
  [● Parcial (2/5)]
  ```
  onde `●` é um `<span>` 8px arredondado vermelho (`bg-destructive`), só renderiza se `hasUnseen`.
- Mesma melhoria para `Aprovado` quando 100% dos itens estão aprovados → mostra `Aprovado (5/5)` (sem dot se já foi visto).

### `ClientViewer.tsx` (visualizador público)
- Já tem todos os `cv_quote_items` carregados — calcular fração inline e passar para o `Badge`.
- **Nunca** mostra o dot (visualizador é do cliente).

### Marcar como visto
- Em `EditQuoteV2.tsx`, no `useEffect` de carregamento do orçamento, após o fetch principal:
  ```ts
  await supabase
    .from("quotes")
    .update({ last_partial_seen_at: new Date().toISOString() })
    .eq("id", quoteId);
  ```
- Realtime já existente em `quotes` propaga o sumiço do dot para outras abas abertas.

---

## Fora de escopo
- Tracking de "visto por usuário X" individual (single timestamp serve para a equipe inteira).
- Animação ou cor diferente no badge — mantém estética minimalista.
- Mudança no badge `Pendente` / `Recusado`.
