

# Júlia: corrigir confusão entre "horário do aviso" e "horário do compromisso"

## Diagnóstico (causa raiz)

Olhando a conversa da screenshot, três bugs combinados explicam o comportamento errático:

### Bug 1 — Listagem mostra `remind_at` (aviso), não o compromisso real
O que apareceu para o usuário:
```
- 11h00 — Treino às 11h15
- 11h45 — Treino às 12h
- 16h45 — Treino às 13h15
```
Cada linha tem dois horários diferentes porque o **bullet usa `remind_at`** (horário do aviso) e o **título guarda o horário real do compromisso**. Para o usuário parece "tem 7 treinos no dia"; na verdade são 3 treinos com avisos antecipados. Confunde o usuário e confunde a própria Júlia nas decisões seguintes.

### Bug 2 — Detecção de conflito olha o `remind_at`, não o compromisso
`check_reminder_conflict` compara o horário proposto contra `remind_at` dos pendentes. Resultado: ao tentar marcar **Dentista às 16h15**, a Júlia detectou conflito com "Treino às 13h15" (que tem `remind_at` próximo de 16h45 por algum aviso antecipado). Conflito falso → trava em "quer marcar mesmo assim?".

### Bug 3 — DEDUPE entra mesmo em comando misto
A mensagem "cancela o oftalmo e marca Dentista às 16h15" tinha intenção dupla. Apesar da regra de PRIORIDADE MÁXIMA, o modelo entrou no fluxo de DEDUPE/CONFLITO antes de processar o "marcar Dentista" como criação nova legítima.

### Bug 4 — Loop de chips
Após "na hora", a Júlia voltou a perguntar conflito em vez de criar — porque o conflito falso (bug 2) reentrou no fluxo.

## Correções

### 1. Separar dois campos: `event_at` (compromisso) vs `remind_at` (aviso)
Migration nova:
- Adicionar coluna `event_at timestamptz null` em `public.reminders`. Significa "horário real do compromisso". Quando o lembrete é apenas tarefa avulsa ("tomar água às 16h"), `event_at = remind_at`.
- Backfill: `UPDATE reminders SET event_at = remind_at WHERE event_at IS NULL` (registros antigos viram tarefas avulsas — sem aviso antecipado).
- Sem mudar `remind_at` (continua sendo o trigger de notificação).

### 2. `reminders-api`: aceitar e devolver `event_at`
Arquivo: `supabase/functions/reminders-api/index.ts`
- `POST` aceita `event_at` opcional no body. Se ausente, usa `remind_at`.
- `GET` devolve `event_at` em todos os retornos.
- `GET /conflicts`: passa a olhar **`event_at`** dentro da janela ±15min, não mais `remind_at`. (Conflito é entre compromissos reais, não entre horários de aviso.)
- Validação: se `event_at` vier, deve ser ≥ `remind_at` (faz sentido só avisar antes do evento, não depois).

### 3. `assistente-virtual`: prompt + tool `create_reminder`
Arquivo: `supabase/functions/assistente-virtual/index.ts`

**Tool schema** — `create_reminder` ganha campo `event_at`:
- `remind_at`: quando disparar o aviso (ex.: 13h15).
- `event_at`: horário real do compromisso (ex.: 16h). Se for tarefa avulsa, omitir.

**Prompt — regras novas em `camada1`**:
- "COMPROMISSO COM HORÁRIO MARCADO": ao calcular o aviso ("1h antes do dentista das 14h"):
  - `remind_at = 13h00` (quando avisar)
  - `event_at = 14h00` (compromisso real)
  - `title = "Dentista"` (sem "às 14h" — o horário sai do `event_at`)
- "TAREFA AVULSA" ("me lembra de tomar água às 16h"): só `remind_at`, sem `event_at`.
- "LISTAGEM DE LEMBRETES" — o bullet DEVE usar `event_at` (ou `remind_at` se `event_at` for null), e mostrar a antecedência em texto pequeno entre parênteses só se diferente:
  ```
  - **14h00** — Dentista (aviso 13h)
  - **16h00** — Tomar água
  ```
  Não duplicar "às 14h" no título.
- "DEDUPE OBRIGATÓRIO": continua, mas agora compara `event_at` no mesmo dia (não `remind_at`).
- "DETECÇÃO DE CONFLITO": continua chamando `check_reminder_conflict` mas passa o `event_at` do novo compromisso.

### 4. `check-reminders` (cron): nada muda
O worker continua disparando notificação por `remind_at` (que é o "quando avisar") — isso já está correto.

### 5. Corrigir o bug do comando misto travado (independente do refactor)
No prompt `camada1`, reforçar:
- "COMANDOS MISTOS — REGRA DE INDEPENDÊNCIA": cada subcomando é avaliado isoladamente. O `cancela X` NÃO bloqueia o `marca Y`. Se o segundo subcomando dispara conflito legítimo, processe o primeiro até o fim e só depois pergunte sobre o segundo. Se o conflito for falso (após refactor do `event_at`), nem aparece.

### 6. Sincronizar Google Calendar com `event_at`
Arquivo: `supabase/functions/gcal-sync-worker/index.ts` (ler para confirmar payload).
- O evento no Google deve usar `event_at` como hora de início (não `remind_at`). Hoje provavelmente usa `remind_at`, o que faz o evento aparecer no Google na hora do aviso, não na hora do compromisso real.
- Ajustar o payload do `create`/`update` pra mandar `start = event_at ?? remind_at`.

## Arquivos alterados

- migration nova (coluna `event_at` + backfill)
- `supabase/functions/reminders-api/index.ts`
- `supabase/functions/assistente-virtual/index.ts`
- `supabase/functions/gcal-sync-worker/index.ts`

## Resultado esperado

Pergunta: "compromissos dia 27"
Júlia (após fix):
```
Seus pendentes para segunda-feira, 27 de abril:
- **11h15** — Treino (aviso na hora)
- **12h00** — Treino (aviso 15min antes)
- **13h15** — Treino (aviso 1h antes)
- **13h00** — Oftalmo
- **16h00** — Teste Sistema 2
- **17h00** — Oftalmo
```
(Lista enxuta, sem duplicar horário no título, sem confundir aviso com compromisso.)

Pergunta: "cancela o oftalmo e marca Dentista às 16h15"
Júlia: cancela oftalmo (1 delete), checa conflito de Dentista 16h15 contra `event_at` dos pendentes (não tem nada às 16h15), pergunta antecedência do Dentista com chips. Sem conflito falso.

## Fora do escopo

- Sem mudar UI de notificações.
- Sem migrar o conceito de `event_at` para outras features.
- Sem expor edição direta do `event_at` no frontend.

