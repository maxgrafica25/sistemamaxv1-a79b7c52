

# Júlia: corrigir IDs inventados no delete + listagem confusa

## O que aconteceu (causa raiz, com evidência)

Logs do edge function:
```
delete_reminder args → {"id":"313797b5-025b-4260-847e-aee6e6ee980b"} → "Lembrete não encontrado"
delete_reminder args → {"id":"4d5d974e-5a02-4ee1-b952-1925b06214cd"} → "Lembrete não encontrado"
```

Esses dois UUIDs **não existem na tabela**. Os IDs reais do dia 27/04 são outros (ex: `cdf4a8d4-...` para "Treino às 11h", `a6371060-...` para "Teste Sistema 1" das 17h).

**A Júlia inventou os UUIDs.** Ela não chamou `list_reminders` antes do delete — passou direto pra `delete_reminder` com IDs alucinados. A regra "use o UUID exato do `list_reminders` da mesma iteração" foi adicionada no prompt, mas o modelo está ignorando porque a lista foi mostrada na **mensagem anterior**, não na iteração atual, então ele acha que "lembra" do ID e gera um plausível.

## Bug secundário descoberto na mesma listagem

Olhando a screenshot e o banco:
- Banco tem `event_at = 13h45` com título "Treino às 11h" → a Júlia mostrou "11h00 — Treino" (extraiu do título, não do `event_at`).
- Banco tem `event_at = 19h00` com título "Treino às 13h15" → mostrou "14h00 — Treino" (errado dos dois lados).

Os dados antigos têm `event_at` = `remind_at` (do backfill), não o horário real do compromisso. O título "Treino às 11h" guarda o horário real. A Júlia está extraindo o horário do **título** em vez de usar o `event_at`, e ainda por cima ignora os "minutos" às vezes.

Ou seja: o refactor `event_at` não ajuda os registros antigos porque o backfill copiou `remind_at` (que era o aviso, não o evento). Esses registros têm `event_at` errado pra sempre.

## Correções

### 1. Forçar `list_reminders` antes de QUALQUER `delete_reminder` na mesma iteração
Arquivo: `supabase/functions/assistente-virtual/index.ts`

No loop de tool-calling, adicionar **guard de servidor** (não confia só no prompt):
- Manter um `Set<string>` de IDs vistos vindos de `list_reminders` / `list_cancelled_reminders` na iteração atual.
- Se `delete_reminder` for chamado com um `id` que NÃO está nesse set, **rejeitar a chamada** retornando ao modelo: `{"error":"id não verificado nesta sessão. Chame list_reminders primeiro e use exatamente o UUID retornado."}`
- Isso impede a alucinação de UUID estruturalmente, não por instrução de prompt.

### 2. Reforçar prompt: re-listar antes de remarcar/cancelar
No `camada1`, regra explícita:
- "Antes de qualquer `delete_reminder`, você DEVE chamar `list_reminders` na mesma iteração e copiar o `id` exato do retorno. Nunca use IDs de mensagens anteriores — eles podem ter mudado."

### 3. Listagem deve usar `event_at` E ignorar horário do título
- Regra: "Ao listar, exiba SEMPRE o horário de `event_at` formatado. NUNCA extraia horário do `title`. Se o título contém 'às 11h', remova essa parte ao exibir (mostre só 'Treino')."

### 4. Migration de correção dos dados antigos
- Para registros onde o `title` casa o regex `/às (\d{1,2})h(\d{2})?/i`, recalcular `event_at` baseado no horário do título mantendo a data de `remind_at`.
- Limpar o " às XXh" do `title` para os ajustados.
- Cuidado: rodar só em `cancelled_at IS NULL AND is_completed = false` para não bagunçar histórico.

### 5. Log adicional
- Quando `delete_reminder` rejeitar por ID não-verificado, logar `{rejected: true, id, reason: "uuid_not_in_session"}` para confirmar via logs que o guard pegou.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts` (guard + prompt)
- migration nova (recalcular `event_at` e limpar título dos pendentes do dia 27/04 e similares)

## Resultado esperado

- Júlia nunca mais consegue chamar `delete_reminder` com UUID inventado — o servidor bloqueia.
- Listagem mostra horários corretos vindos de `event_at`, com títulos limpos.
- "trocar treino das 11 para 11h30 e cancelar das 17h" funciona: `list_reminders` → pega IDs reais → 2 deletes + 1 create, todos confirmados.

## Fora do escopo

- Sem mudar UI.
- Sem mexer em conflito/dedupe (já tratados).

