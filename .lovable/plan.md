

# Júlia: filtrar por data no servidor + corrigir fuso na criação

## Problema 1 — Lista ignora filtro de data quando pede confirmação

Quando você perguntou "o que tenho dia 27?", a Júlia filtrou certinho e mostrou 4 itens. Mas quando você pediu "altera 13 para 14 e cancela 13h15", ela montou a lista de fallback ("qual cancelar?") despejando **todos os lembretes futuros** (24, 25, 27 e 28/04), porque o `list_reminders` retorna sempre todos os 200 próximos e o filtro de data depende do modelo lembrar do contexto.

**Correção:** adicionar parâmetros `from_date` e `to_date` (formato `YYYY-MM-DD` em hora local Brasil) na tool `list_reminders`. O servidor passa a filtrar por `event_date_br`. E o fallback servidor-side (quando há `uuid_not_in_session`) também passa a respeitar o último filtro de data usado na sessão — guardado em variável local do request.

## Problema 2 — Fuso horário invertido no `create_reminder`

O lembrete "Treino 12h30" criado às 16h21 local foi salvo com `event_at = 18:30 UTC` → exibe como **15h30** local. Diferença de 3 horas = fuso UTC vs Brasil aplicado errado (somou em vez de subtrair, ou tratou input local como se fosse UTC e depois converteu de novo).

**Correção:** revisar o trecho do prompt que orienta o modelo a montar `event_at` ISO. Atualmente o prompt diz "use UTC", mas o modelo está mandando o horário local **rotulado** como UTC. Precisa ou:
- (a) Mudar o prompt: "envie horário local Brasil sem offset, ex: `2026-04-27T12:30:00`, o servidor adiciona `-03:00`", e o servidor (`reminders-api`) converte para UTC antes de inserir; ou
- (b) Forçar no servidor: detectar quando `event_at` chegou em UTC mas o horário "local" implícito está 3h adiantado em relação ao agora.

Vou pela opção (a) — mais explícito e evita lógica de adivinhação. Atualizo o schema da tool `create_reminder` para aceitar `event_local` (string `YYYY-MM-DDTHH:mm`) e `remind_local`, e o `executeTool("create_reminder")` converte para UTC com offset `-03:00` antes de chamar a API.

## Problema 3 — Item 41380526 com horário errado no banco

O lembrete já criado (event_at 18:30 UTC, exibido 15h30) está incorreto — você pediu 12h30 (que seria 15:30 UTC). Migration pontual: corrigir `event_at = 2026-04-27T15:30:00+00:00` e `remind_at = 2026-04-27T15:15:00+00:00`. Ou simplesmente cancelar e deixar você recriar — vou cancelar via migration pra limpar, é mais seguro.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts`:
  - Schema de `list_reminders`: adicionar `from_date` e `to_date` (string `YYYY-MM-DD`, opcionais).
  - `executeTool("list_reminders")`: filtrar resposta por `event_date_br` quando vierem os parâmetros. Guardar o último filtro usado na variável `lastDateFilter` do escopo do request.
  - Schema de `create_reminder`: trocar `event_at`/`remind_at` (ISO UTC) por `event_local`/`remind_local` (string `YYYY-MM-DDTHH:mm`, hora Brasil).
  - `executeTool("create_reminder")`: converter `*_local` para ISO com offset `-03:00` antes de chamar `reminders-api`.
  - Atualizar prompt da Júlia: explicar os novos campos das tools (data local, sem fuso).
  - Fallback `uuid_not_in_session`: usar `lastDateFilter` para a lista de "aqui estão os pendentes".
- 1 migration SQL: cancelar `41380526` (lembrete com horário errado) com `cancelled_reason = 'rescheduled'`.

## Resultado esperado

- "O que tenho dia 27?" → 4 itens (igual hoje, mas agora vindo já filtrado do servidor).
- "Altera X e cancela Y" sem casar IDs → fallback mostra **só os 4 do dia 27**, não despeja a semana toda.
- "Cria Treino 12h30 dia 27" → grava `event_at = 15:30 UTC`, exibe `12h30`.

## Fora do escopo

- Sem mudar o schema da tabela `reminders`.
- Sem mexer em UI.
- Sem trocar modelo.

