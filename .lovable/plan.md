

# Júlia agente proativo — Fase 1.1 + 1.2: Lembretes via linguagem natural

## Diagnóstico do que já existe

O projeto **já tem** infraestrutura de lembretes funcionando:

- Tabela `reminders` (com `user_id`, `title`, `description`, `remind_at`, `recurrence`, `category`, `source_id`, `is_completed`) — usada por `QuoteReminderButton.tsx` e `NotificationBell.tsx`.
- Tabela `notifications` (inbox + realtime) já consumida pelo `NotificationBell` com `postgres_changes`.
- Edge Function `check-reminders` (cron) que varre `reminders` vencidos e cria `notifications` correspondentes, com suporte a recorrência.

**Conclusão:** não vamos criar tabela nova nem duplicar API. Vamos **reutilizar** a tabela `reminders` existente e ensinar a Júlia a manipulá-la via tool calling do Gemini. Disparo de alerta e UI de notificação já estão prontos.

Ajuste de nomenclatura vs. plano original:
- `description` do plano → `title` da tabela (campo obrigatório existente; `description` da tabela vira detalhe opcional).
- `alert_before_minutes` não existe e **não é necessário**: o cron já dispara quando `remind_at <= now()`. Se o usuário pedir "me avise 1h antes das 14h", a Júlia agenda `remind_at = 13h` e ponto.
- `recurrence` ('none'|'daily'|'weekly'|'monthly') já é suportado pelo cron.

## O que muda

### 1. Edge Function nova: `supabase/functions/reminders-api/index.ts`

Endpoints REST autenticados via JWT (`getClaims`), CORS padrão Lovable, validação Zod:

- `POST /` — body `{ title, description?, remind_at (ISO), recurrence?, category? }` → insere em `reminders` com `user_id` do JWT. Valida `remind_at` no futuro.
- `GET /` — lista lembretes do usuário (`is_completed=false`, ordenados por `remind_at`), com filtro opcional `?include_completed=1`.
- `DELETE /?id=<uuid>` — remove lembrete do usuário (RLS já garante posse via política existente em `reminders`).

Sem `verify_jwt = true` no config — validação em código com `getClaims()`, padrão do projeto.

### 2. Edge Function `assistente-virtual/index.ts` — adicionar tool calling

**a) Camada 1 do prompt:** acrescentar bloco de "FERRAMENTAS DISPONÍVEIS" com 3 funções declaradas (`create_reminder`, `list_reminders`, `delete_reminder`) e regras:
- Não inventar datas. Se faltar data/hora, perguntar.
- Sempre confirmar após executar (repetindo descrição + data/hora em pt-BR).
- Resolver expressões relativas ("amanhã 14h", "sexta 10h", "daqui a 2 horas") para ISO usando a data/hora atual injetada no prompt (`Hoje é <data> <hora> America/Sao_Paulo`).
- Para "me avise X antes de Y", calcular `remind_at = Y - X` e gravar como horário do lembrete.

**b) Declarar tools no payload do Gemini** (`tools: [{ functionDeclarations: [...] }]`) com schema JSON dos 3 métodos.

**c) Loop de tool execution:** após primeira chamada, se a resposta vier com `functionCall`, executar localmente chamando a `reminders-api` (passando o `Authorization` original do usuário), devolver `functionResponse` ao Gemini num segundo turno e usar o texto final como resposta. Limite de 3 iterações para evitar loops.

**d) Helpers locais** (mesma function, sem nova rede quando possível):
- `callRemindersApi(method, path, body, authHeader)` — fetch para a edge function com header forwarded.
- Mapeamento direto Gemini ↔ REST.

### 3. Frontend — `AssistenteButton.tsx` (ajuste mínimo)

Já existe `NotificationBell` ouvindo `notifications` em realtime → quando o cron `check-reminders` disparar, o sininho atualiza sozinho. Nada a fazer no inbox.

**Único ajuste:** ao invocar `assistente-virtual`, garantir que o token JWT do usuário seja repassado (já é, via `supabase.functions.invoke` que injeta o `Authorization`). Confirmado pelo código atual.

### 4. Cron `check-reminders` — sem alterações

Já lê `reminders` por `remind_at <= now()` e cria `notifications`. Lembretes criados pela Júlia entram automaticamente nesse fluxo.

## Fluxo end-to-end

```text
Usuário (chat): "Me lembre do dentista amanhã às 14h"
   │
   ▼
assistente-virtual (Gemini com tools)
   │  functionCall: create_reminder({title:"Dentista", remind_at:"2026-04-23T17:00:00Z"})
   ▼
reminders-api  POST /  (user JWT)
   │  INSERT INTO reminders (...)
   ▼
Resposta: {id, ...}
   │
   ▼
Gemini turno 2 → "Pronto! Lembrete do dentista criado para amanhã às 14h."
   │
   ... no horário ...
   ▼
cron check-reminders → INSERT notifications → Realtime → NotificationBell toca
```

## Detalhes técnicos

- **Resolução temporal:** o prompt recebe `now()` em ISO + timezone `America/Sao_Paulo` em cada chamada. Gemini converte expressões relativas. Validação final no `reminders-api` rejeita `remind_at <= now()`.
- **Tool calling com Gemini via Lovable AI Gateway:** o gateway é OpenAI-compatible; usar formato `tools: [{ type: "function", function: {...} }]` e `tool_choice: "auto"`. Resposta vem em `choices[0].message.tool_calls`. Loop até `finish_reason !== "tool_calls"`.
- **Segurança:** toda manipulação de lembrete passa pelo JWT do usuário; RLS da tabela `reminders` (já existente) garante isolamento. A `reminders-api` nunca usa service role.
- **Categoria:** lembretes criados pela Júlia recebem `category = "assistente"` para diferenciar dos criados por `QuoteReminderButton` (`category="quote"`).

## Não muda
- Tabela `reminders`, `notifications`, RLS, cron `check-reminders`.
- Lógica de preços, autenticação, Camada 2 (base de conhecimento) e seções de equipamentos/preços da Camada 3 do prompt.
- `NotificationBell`, `QuoteReminderButton`, demais telas.

## Validação após deploy

1. *"Me lembre do dentista amanhã às 14h"* → Júlia confirma; novo registro em `reminders` com `remind_at` correto e `category="assistente"`.
2. *"Agende reunião sexta às 10h, me avise 1h antes"* → `remind_at` = sexta 09:00.
3. *"Me lembre de ligar pro Juliano"* → Júlia pergunta data/hora antes de criar.
4. *"Quais meus lembretes?"* → Júlia lista os pendentes do usuário.
5. *"Cancele o lembrete do dentista"* → Júlia identifica e remove (pede confirmação se houver mais de um match).
6. No horário marcado, sininho do `NotificationBell` toca via realtime — sem código novo no frontend.

## Risco

Médio-baixo. Reaproveita infra pronta (tabela, cron, realtime, inbox). Risco principal é a confiabilidade do tool calling do Gemini para extração de datas — mitigado por (a) injetar `now()` no prompt, (b) validação server-side, (c) regra explícita de pedir confirmação quando ambíguo.

## Fora deste escopo (próximas fases)

- Sugestões proativas (toner baixo etc.) — Fase 2.
- Automação de tarefas que alteram estado (orçamentos, ordens) — Fase 3.
- Estado conversacional multi-turn persistente (slots de orçamento) — Fase 4.

