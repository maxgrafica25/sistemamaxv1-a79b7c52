

# Fase 1 — Recorrência funcional de lembretes

## Diagnóstico do código atual

Em `supabase/functions/check-reminders/index.ts`, o fluxo de recorrência está quebrado:

1. Só tenta reagendar **depois que detecta uma notificação já existente** — ou seja, na segunda execução do cron, não na primeira.
2. Quando reagenda, **não cria a notificação da ocorrência atual** (`continue` pula a criação).
3. Avança a data só **uma vez**; se o cron atrasou e a próxima ocorrência ainda é passada, fica travado.
4. Não existe coluna `alert_sent_at` na tabela — o controle de "já notificado" hoje é feito olhando se já existe `notifications` com mesmo `source_id`. Vou manter esse padrão (não criar coluna nova).

## O que muda

**Arquivo único**: `supabase/functions/check-reminders/index.ts`. Reescrever o loop para:

Para cada lembrete vencido:

1. **Verificar duplicata**: se já existe `notification` com `source_type='reminder'` + `source_id=reminder.id` + `due_date=reminder.remind_at` (mesma ocorrência), pular.
2. **Criar a notificação** da ocorrência atual (sempre, recorrente ou não).
3. **Se `recurrence === 'none'`**: marcar `is_completed = true`.
4. **Se recorrente** (`daily`/`weekly`/`monthly`):
   - Calcular próxima data a partir do `remind_at` atual usando `Date` nativo (`setDate(+1)`, `setDate(+7)`, `setMonth(+1)`).
   - **Loop de avanço**: enquanto a próxima data ainda for `<= now()`, avançar mais um intervalo. Isso cobre cron atrasado ou lembretes antigos esquecidos.
   - `UPDATE reminders SET remind_at = <próxima>, updated_at = now() WHERE id = reminder.id`.
   - Mantém `is_completed = false`.

**Chave anti-duplicata** muda de `(source_type, source_id, user_id)` para `(source_type, source_id, user_id, due_date)` — assim cada ocorrência da recorrência gera uma notificação distinta sem colidir com as anteriores.

## Detalhes técnicos

- Sem mudança de schema, RLS, cron, frontend ou outras edge functions.
- Cálculo de datas em UTC nativo do JS — `TIMESTAMPTZ` do Postgres garante consistência.
- `setMonth(+1)` em 31/jan vira 02/mar (comportamento JS). Aceitável para o caso de uso (lembretes pessoais); se virar problema, trocamos por lógica de "último dia do mês" depois.
- Sem dependência nova (`date-fns` não está no projeto Deno; nativo basta).
- Risco: baixo — função isolada, executada por cron a cada minuto, fácil de observar pelos logs.

Esqueleto da nova lógica (linhas ~30-80 de `index.ts`):

```text
for each reminder in dueReminders:
  alreadyNotified = exists notification where
    source_type='reminder' AND source_id=reminder.id
    AND user_id=reminder.user_id AND due_date=reminder.remind_at
  if alreadyNotified: continue

  insert notification(title, message, type='reminder',
    source_type='reminder', source_id=reminder.id,
    due_date=reminder.remind_at, user_id=reminder.user_id)

  if reminder.recurrence == 'none':
    update reminders set is_completed=true where id=reminder.id
  else:
    next = reminder.remind_at
    repeat:
      next = advance(next, reminder.recurrence)
    until next > now()
    update reminders set remind_at=next where id=reminder.id

  processed++
```

## Validação após deploy

1. **Diário**: criar lembrete `recurrence='daily'`, `remind_at = now() + 1min`. Esperar o cron. Verificar:
   - `notifications` ganhou 1 linha com `due_date` = horário original.
   - `reminders.remind_at` agora é amanhã, mesmo horário.
   - `is_completed` continua `false`.
2. **Semanal e mensal**: mesmo teste com `weekly` (avança +7 dias) e `monthly` (avança +1 mês).
3. **Não recorrente**: `recurrence='none'`, `remind_at = now() + 1min`. Após cron: 1 notificação criada, `is_completed=true`, `remind_at` inalterado.
4. **Atraso simulado**: criar lembrete diário com `remind_at` 3 dias no passado. Após cron: cria 1 notificação (única) e `remind_at` salta direto para a próxima data **futura** (não fica em loop nem atrasado).
5. **Idempotência**: rodar o cron duas vezes seguidas no mesmo minuto não duplica notificação.

## Fora deste escopo

- Notificar todas as ocorrências perdidas (hoje cria só uma "agora" e pula para a próxima futura — comportamento desejado para não floodar o sininho).
- `update_reminder` via Júlia.
- Google Calendar (Fase 2.5).

