

# Júlia: distinguir "cancelado" de "alterado/remarcado"

## Problema

Pergunta: "Algo cancelado pra dia 27?"
Resposta atual: "Treino às 11h15 — cancelado em 23/04 às 15:49. Teste Sistema 1 às 14h — cancelado em 23/04 às 15:49."

O Treino 11h15 não foi cancelado — foi **remarcado** para 13h. Só o Teste Sistema 1 foi cancelado de verdade. A confusão acontece porque todo `delete_reminder` grava `cancelled_reason = 'user_cancelled'`, sem distinguir o motivo.

## Causa raiz

1. `reminders-api` DELETE sempre escreve `cancelled_reason: "user_cancelled"`.
2. O assistente-virtual já detecta "modo remarcar" (`isRemarcarSession`) mas não passa essa informação adiante quando chama `delete_reminder`.
3. `list_cancelled_reminders` devolve todos os cancelados sem dizer se foi cancelamento puro ou parte de um remarcar.
4. Prompt da consulta histórica trata tudo como "cancelado".

## Correções

### 1. `reminders-api` aceita `reason` opcional no DELETE
Arquivo: `supabase/functions/reminders-api/index.ts`
- Aceitar query param `?id=...&reason=rescheduled` (ou `user_cancelled`, default).
- Validar contra um whitelist: `["user_cancelled", "rescheduled"]`.
- Gravar no campo `cancelled_reason` existente (sem mudar schema).

### 2. Tool `delete_reminder` ganha campo `reason`
Arquivo: `supabase/functions/assistente-virtual/index.ts`
- Schema: adicionar `reason: enum["user_cancelled", "rescheduled"]`, default `"user_cancelled"`.
- Quando `executeTool("delete_reminder")` rodar em modo remarcar (`isRemarcarSession === true`), **forçar `reason = "rescheduled"`** server-side (mesmo se o modelo esquecer de passar).
- Repassar o `reason` na chamada à `reminders-api`.

### 3. Prompt: regra clara para a consulta histórica
Atualizar a regra "CONSULTA HISTÓRICA" no `camada1`:
- Ao processar resposta de `list_cancelled_reminders`, separar por `cancelled_reason`:
  - `"user_cancelled"` → "foi **cancelado** em <data>"
  - `"rescheduled"` → "foi **remarcado** em <data> (movido para outro horário)"
- Se o usuário perguntar especificamente "o que foi **cancelado**?", responder SÓ os com `cancelled_reason = "user_cancelled"` e ignorar os remarcados.
- Se perguntar genérico "o que aconteceu com X?", mostrar ambos com o termo correto.

### 4. Limpeza pontual dos dados existentes (SQL one-shot)
Os dois Treinos cancelados nas sessões anteriores como parte de remarcar têm `cancelled_reason = 'user_cancelled'`. Atualizar para `rescheduled`:
- IDs já identificados nos logs anteriores: `76590693-...` (Treino 11h15), `cdf4a8d4-...` (Treino 11h), e qualquer outro Treino cancelado em 23/04 onde haja outro Treino criado nos minutos seguintes para data próxima.
- Migration simples atualizando esses IDs específicos por uma query: lembretes do user, `cancelled_reason='user_cancelled'`, cancelados em 23/04, cujo `title` começa com "Treino" e existe outro `Treino` ativo do mesmo `user_id` criado dentro de 5min após o cancellation.

## Arquivos alterados

- `supabase/functions/reminders-api/index.ts`
- `supabase/functions/assistente-virtual/index.ts`
- migration nova (corrigir histórico de Treinos remarcados)

## Resultado esperado

Pergunta: "Algo cancelado pra dia 27?"
Júlia: "Sim — **Teste Sistema 1 às 14h** foi cancelado em 23/04 às 15:49."
(Os Treinos remarcados não aparecem porque não foram cancelados — foram remarcados.)

Pergunta: "O que aconteceu com os treinos do dia 27?"
Júlia: "**Treino 11h15** foi **remarcado** em 23/04 (movido pra 13h). **Treino 11h** foi **remarcado** anteriormente."

## Fora do escopo

- Sem mudar schema (usa `cancelled_reason` que já existe).
- Sem expor "restaurar" no frontend.
- Sem mudar UI da inbox.

