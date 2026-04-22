

# Júlia: detecção de conflitos de horário

## O que muda para você

Antes de criar (ou futuramente atualizar) qualquer lembrete com horário, a Júlia checa se você já tem outro lembrete dentro de **±15 minutos**. Se houver:

- Ela responde algo como: *"Você já tem 'Dentista' às 14h. Quer marcar 'Reunião' no mesmo horário mesmo assim, ou prefere outro horário?"*
- Aguarda sua decisão. Se confirmar, cria. Se pedir outro horário, ajusta.

Se não houver conflito, cria direto sem perguntar (não adiciona fricção desnecessária).

## Arquivos tocados

### 1. `supabase/functions/reminders-api/index.ts`

Novo handler `GET` quando a URL termina com `/conflicts`:

- Query params: `remind_at` (ISO obrigatório), `window_minutes` (padrão 15), `exclude_id` (opcional, para futuro `update_reminder`).
- Valida `remind_at` com Zod, calcula janela `[remind_at - X, remind_at + X]`.
- `SELECT id, title, remind_at, recurrence FROM reminders WHERE user_id = auth AND is_completed = false AND remind_at BETWEEN start AND end AND id <> exclude_id`.
- Retorna `{ conflicts: [...] }` com 200. Lista vazia = sem conflito.
- RLS já garante isolamento por `user_id`.

### 2. `supabase/functions/assistente-virtual/index.ts`

**Nova tool no schema do Gemini**:

```
check_reminder_conflict(remind_at, window_minutes?=15, exclude_id?)
```

**Roteamento em `executeTool`**: chama o novo endpoint `/conflicts` via `callRemindersApi("GET", { conflicts: true, ...args })` (ou helper dedicado), repassando o Authorization do usuário.

**Regra nova no prompt `camada1`** (FERRAMENTAS / REGRAS):

- "Antes de chamar `create_reminder` (e futuramente `update_reminder`) com `remind_at` definido, você DEVE chamar `check_reminder_conflict` primeiro com `window_minutes=15`."
- "Se a resposta tiver lembretes em `conflicts`: NÃO crie ainda. Liste o(s) conflito(s) ao usuário com título e horário, pergunte se ele quer manter mesmo assim ou escolher outro horário, e aguarde a resposta."
- "Se o usuário confirmar (ex.: 'pode marcar', 'sim'), aí sim chame `create_reminder`. Se pedir outro horário, peça o novo horário e refaça a verificação."
- "Se `conflicts` estiver vazio, prossiga normalmente."

A regra do fluxo de antecedência (chips) continua valendo: a checagem de conflito acontece **depois** que o `remind_at` final foi calculado (post-chip), não no horário do compromisso.

## Detalhes técnicos

- Sem mudança de schema, RLS, cron, frontend, ou nas tools existentes (`create_reminder`, `list_reminders`, `delete_reminder`).
- `exclude_id` já entra agora para preparar terreno do futuro `update_reminder` — sem custo adicional.
- Janela default 15min cobre os casos práticos (compromissos colados) sem gerar falso positivo em coisas distantes.
- Lembretes recorrentes só conflitam pela próxima ocorrência (`remind_at` atual da linha) — suficiente para o caso de uso.
- Risco: baixo. Endpoint novo isolado, lógica de conflito vive no prompt + tool — se a Júlia esquecer de chamar a tool num caso, o pior é criar duplicado (comportamento atual).

## Validação após deploy

1. **Conflito na criação**: criar "Dentista amanhã 14h" (com chip "1h antes" → lembrete às 13h). Depois pedir "Reunião amanhã 13h05" → Júlia avisa do conflito com Dentista, pergunta. Confirmar → cria. Negar e dar novo horário → cria no novo horário.
2. **Sem conflito**: criar "Dentista 14h" e depois "Almoço 12h" → cria direto, sem aviso.
3. **Janela exata**: lembrete às 14h00 + novo às 14h20 → fora da janela de 15min, cria sem aviso. Novo às 14h10 → dentro da janela, avisa.
4. **Lembrete concluído não conflita**: lembrete passado já marcado `is_completed=true` na mesma hora não dispara aviso.
5. **Endpoint isolado** (curl): `GET /reminders-api/conflicts?remind_at=...&window_minutes=15` retorna `{ conflicts: [...] }`.

## Fora deste escopo

- `update_reminder` (a tool nem existe ainda; `exclude_id` fica preparado).
- Sugestão automática de horário alternativo (hoje a Júlia só pergunta; a IA pode sugerir baseada em huecos, mas é fase futura).
- Conflitos com Google Calendar (Fase 2.5).

