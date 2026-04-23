

# Júlia: avisar quando um compromisso foi cancelado

## Problema

Quando o usuário pergunta "eu tinha algum compromisso dia 27 às 16h?" depois de ter pedido para cancelar, a Júlia responde "Nada agendado para 27/04 às 16h". Isso é tecnicamente verdade (o registro foi apagado), mas confunde — o usuário queria saber se *havia* algo lá.

Hoje o fluxo de cancelar chama `delete_reminder`, que faz `DELETE` físico na tabela `reminders`. Não sobra rastro nenhum, então `list_reminders` não tem como saber que existiu.

## Solução: soft-delete + consulta histórica

### 1. Migration: marcar cancelados em vez de apagar
- Adicionar coluna `cancelled_at timestamptz null` em `public.reminders`.
- Adicionar coluna `cancelled_reason text null` (livre, ex.: "cancelado pelo usuário via Júlia").
- Índice parcial em `(user_id, remind_at)` filtrando `cancelled_at is null` para manter listagens rápidas.

### 2. `reminders-api`: trocar DELETE físico por soft-delete
Arquivo: `supabase/functions/reminders-api/index.ts`
- No handler `DELETE`, em vez de `.delete()`, fazer `update({ cancelled_at: now(), cancelled_reason: 'user_cancelled' })`.
- Continuar exigindo UUID válido e `user_id` do dono.
- Continuar retornando 404 quando o id não existir OU já estiver cancelado (para a Júlia não confirmar duas vezes).
- Continuar retornando `{ ok: true, deleted_id }` no sucesso (mesma forma — assistente não precisa saber que virou soft-delete).
- Em `GET` (listar pendentes): filtrar `cancelled_at is null` (igual ao que `is_completed=false` já faz hoje, somando a regra).
- Adicionar query param novo: `GET /reminders-api?include_cancelled=1&from=ISO&to=ISO` — retorna também os cancelados na janela, com campos `cancelled_at` populados. Usado só para consulta histórica.

### 3. Atualizar `check-reminders` (cron) para ignorar cancelados
Arquivo: `supabase/functions/check-reminders/index.ts`
- Adicionar `.is('cancelled_at', null)` na query principal pra não disparar notificação de algo que o usuário cancelou.

### 4. Nova ferramenta para a Júlia: `list_cancelled_reminders`
Arquivo: `supabase/functions/assistente-virtual/index.ts`
- Adicionar tool `list_cancelled_reminders({ from, to })` que chama o endpoint com `include_cancelled=1` e retorna só os itens com `cancelled_at != null` na janela.
- Manter `list_reminders()` como está (só pendentes).

### 5. Regra nova no prompt (`camada1`)
Quando o usuário perguntar **se tinha algum compromisso num horário/dia específico** ("eu tinha algo às 16h?", "tinha alguma coisa marcada ontem?", "o compromisso das 16h não estava marcado?"):
1. Chame `list_reminders()` normalmente.
2. Se a lista filtrada por dia/horário vier **vazia**, ANTES de responder "Nada agendado", chame `list_cancelled_reminders` na mesma janela do dia perguntado.
3. Se achar item cancelado batendo:
   - Responda: "Tinha sim — **<título> às <hora>** — mas foi cancelado em <data/hora amigável do `cancelled_at`>."
4. Se não achar nem em pendentes nem em cancelados: aí sim "Nada agendado para <período>."

### 6. Sincronia com Google Calendar
- O trigger `enqueue_gcal_sync` hoje dispara `delete` no `TG_OP = 'DELETE'`. Como agora o cancelamento vira `UPDATE`, ajustar o trigger pra também enfileirar `delete` quando `OLD.cancelled_at IS NULL AND NEW.cancelled_at IS NOT NULL`. O evento no Google continua sendo apagado (comportamento equivalente ao atual).

## Arquivos alterados

- migration nova (coluna + trigger ajustado)
- `supabase/functions/reminders-api/index.ts`
- `supabase/functions/check-reminders/index.ts`
- `supabase/functions/assistente-virtual/index.ts`

## Resultado esperado

Usuário: "eu tinha algum compromisso dia 27 às 16h?"
Júlia: "Tinha sim — **instagram às 16h** — mas você cancelou hoje às 14h42."

Se nunca existiu: "Nada agendado para 27/04 às 16h."

## Fora do escopo

- Sem expor "lixeira" / restaurar cancelados no frontend.
- Sem mudar fluxo de chips, dedupe ou conflito.
- Sem mudar schema de `notifications`.

