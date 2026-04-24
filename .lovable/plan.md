## Problema

Quando a Júlia lista compromissos pendentes, cada item mostra só o horário (`**15h00** — Dentista (aviso 14h45)`). Se o compromisso é em outro dia (ex.: criado para 28/04 enquanto hoje é 24/04), o usuário não consegue saber a data — fica parecendo que é hoje.

A causa está em `supabase/functions/assistente-virtual/index.ts` (linha 1032), na função `formatReminderForDisplay`:
```ts
const display_line = `**${evHHMM}** — ${titleClean}${suffix}${cancelTag}`;
```
Já é calculado o `dateBR` (data BR), mas ele nunca é incluído no `display_line`.

## Correção

Editar `formatReminderForDisplay` para prefixar a data **somente quando o compromisso NÃO é hoje**. Hoje continua só com hora (mantém o estilo enxuto que já existe); em outro dia mostra `**28/04 14h00** — Treino de teste`.

Pseudocódigo da mudança:
```ts
const todayBR = fmtDateBR(new Date().toISOString()); // já em America/Sao_Paulo
const datePrefix = (dateBR && dateBR !== todayBR) ? `${dateBR} ` : "";
const display_line = `**${datePrefix}${evHHMM}** — ${titleClean}${suffix}${cancelTag}`;
```

Aplicado tanto a pendentes (`list_reminders`) quanto a cancelados (`list_cancelled_reminders`), porque ambos passam pela mesma função.

Atualizar também o trecho do system prompt (linha 198-201) que dá o exemplo de `display_line`, mencionando que pode vir com data quando não é hoje, para o modelo não tentar "consertar" o formato.

Redeploy do edge function `assistente-virtual` ao final.

## Validação

1. "Me mostre todos os compromissos da agenda" hoje (24/04) com Dentista hoje 15h e Treino dia 28/04 14h:
   - Esperado: 
     - `**15h00** — Dentista (aviso 14h45)`
     - `**28/04 14h00** — Treino de teste (aviso 13h45)`
2. Listar cancelados do dia anterior também deve mostrar a data correta.
3. Itens só de hoje continuam sem prefixo de data (sem regressão visual).
