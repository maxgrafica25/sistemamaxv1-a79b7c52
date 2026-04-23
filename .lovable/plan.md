

# Júlia: parar de depender do modelo para formatar horários

## Diagnóstico

Estado real do banco para 27/04 (pendentes ativos):
- 12h00 — Treino
- 13h00 — Treino (aviso 10h45)
- 13h15 — Treino (aviso 16h00)
- 14h00 — Teste Sistema 1
- 16h00 — Teste Sistema 2
- 17h00 — Teste Sistema 2 (aviso 16h45)

Júlia disse: 11h00, 12h00, 13h15, 16h00 Treino, 17h00 Teste 1, 17h00 Teste 2. Continua **invertendo `event_at` ↔ `remind_at`** apesar de duas rodadas de regras explícitas no prompt.

**Causa raiz:** o `list_reminders` devolve JSON cru com os dois timestamps em ISO/UTC. O modelo (gemini-2.5-flash) escolhe o primeiro campo de tempo que aparece, ignora o offset, ou converte errado. Regra de prompt não resolve — gemini-flash não é confiável o suficiente pra essa disciplina.

Pior: além disso, o `list_reminders` já filtra `cancelled_at IS NULL`, então os "11h Treino" cancelados NÃO vieram da API. O modelo está **inventando** o item das 11h ou pegando do histórico da conversa anterior. A janela de 10 mensagens passadas inclui listas antigas onde 11h aparecia.

E o "altera 11h pra 11h30 e cancela 16" falhou com `uuid_not_in_session` em ambos os deletes — porque o modelo gerou IDs inventados de novo, mesmo com `available_reminders` injetado. O guard funcionou (bloqueou), mas a UX final só disse "tive um problema interno" duas vezes, sem propor próxima ação clara.

## Correção

### 1. Servidor formata os horários ANTES de devolver (não confia no modelo)

Em `executeTool("list_reminders")`, em vez de devolver o JSON cru da API, transformar cada item em:
```json
{
  "id": "82a34daa-...",
  "title": "Treino",
  "display_line": "**13h00** — Treino (aviso 10h45)",
  "event_local": "13h00",
  "remind_local": "10h45",
  "event_date_br": "27/04/2026",
  "event_at": "<iso>",
  "remind_at": "<iso>"
}
```

A `display_line` é a string EXATA que a Júlia deve copiar para o bullet. Sem chance de inverter campos, sem chance de timezone errado.

Mesma transformação para `list_cancelled_reminders`, com sufixo "(cancelado em DD/MM)" ou "(remarcado em DD/MM)" baseado em `cancelled_reason`.

### 2. Prompt: regra simplificada para listagem

Trocar todo o bloco "REGRA INVIOLÁVEL DOS DOIS CAMPOS" (linhas 199-217) por:
> "Para listar lembretes, use EXATAMENTE o campo `display_line` de cada item de `list_reminders`. Não recalcule, não converta timezone, não invente. Apenas copie. Se faltar bullet, use '- ' antes do `display_line`."

### 3. Mensagem clara quando o reschedule falha por UUID inventado 2x seguidas

No final do loop, se `opResults` contém ≥1 `delete_reminder` falhado por `uuid_not_in_session` E nenhum sucesso, **substituir** a resposta do modelo por uma mensagem servidor-side:
> "Não consegui identificar exatamente quais lembretes alterar. Aqui estão os pendentes pra hoje/27:
> [lista formatada]
> Pode me dizer **qual horário cancelar** e **qual remarcar** copiando da lista acima?"

Isso evita o "tive um problema interno" duplicado e dá ao usuário o que ele precisa pra corrigir.

### 4. Filtrar histórico da conversa antes de mandar ao gateway

O histórico das últimas 10 mensagens contém listas antigas com horários hoje desatualizados (11h Treino que já não existe). O modelo está pegando de lá. **Truncar mensagens do assistant antigas** para no máximo 200 caracteres no contexto enviado ao gateway, ou marcar com prefixo "[histórico — pode estar desatualizado, NÃO use como fonte de horários atuais]".

### 5. Limpeza pontual: cancelar duplicatas residuais de 27/04

Não há duplicatas vivas neste momento (todas as duplicatas anteriores foram canceladas). Nenhuma migration nova precisa.

Mas o `1cd24fd0` (Treino event 13h15 / remind 16h00) tem `remind_at` DEPOIS do `event_at` — invertido no banco. Provavelmente foi criado já trocado. Sugiro corrigir: setar `remind_at = event_at - 15min` = 13h00 UTC (10h00 local). Migration pontual.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts`:
  - `executeTool("list_reminders")` e `executeTool("list_cancelled_reminders")`: transformar resposta com `display_line` pré-formatada em pt-BR.
  - Prompt: substituir bloco de regras de exibição (linhas 199-217) pela regra simplificada "use display_line".
  - Após loop: detectar falha total de delete em sessão de remarcar e injetar mensagem servidor-side com a lista atual.
  - Histórico: truncar respostas antigas do assistant a 200 chars antes de enviar ao gateway.
- 1 migration SQL: corrigir `remind_at` do `1cd24fd0` (de 16h00 UTC para 13h00 UTC).

## Resultado esperado

Pergunta: "o que tenho dia 27?"
Júlia (server-formatted, sem chance de erro):
```
Pendentes para 27/04/2026:
- **12h00** — Treino
- **13h00** — Treino (aviso 10h45)
- **13h15** — Treino (aviso 13h00)
- **14h00** — Teste Sistema 1
- **16h00** — Teste Sistema 2
- **17h00** — Teste Sistema 2 (aviso 16h45)
```

Pergunta: "altera treino 11h para 11h30 e cancela 16"
Como não há Treino às 11h, e 16h é Teste Sistema 2 (não treino), o reschedule vai falhar por UUID inventado. Mensagem que aparece:
> "Não consegui identificar exatamente quais lembretes alterar. Aqui estão os pendentes pra 27/04:
> - **12h00** — Treino
> - **13h00** — Treino (aviso 10h45)
> - **13h15** — Treino
> - **14h00** — Teste Sistema 1
> - **16h00** — Teste Sistema 2
> - **17h00** — Teste Sistema 2
>
> Não tem Treino às 11h. Quer alterar qual desses?"

## Fora do escopo

- Sem mudar schema.
- Sem trocar modelo (gemini-2.5-flash continua, mas agora não precisa formatar nada delicado).
- Sem mexer em UI.

