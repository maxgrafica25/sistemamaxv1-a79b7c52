

# Júlia: responder "compromissos do dia X" usando `list_reminders`

## Problema

Usuário perguntou "Quais são meus compromissos do dia 27/04?" e a Júlia respondeu que não tem acesso por data específica. Isso é falso — ela tem a ferramenta `list_reminders()` que retorna todos os lembretes pendentes; basta filtrar pelo dia pedido na hora de formatar.

A regra atual no prompt só cobre "quais meus lembretes" (linha 284), e não menciona explicitamente perguntas com data ("hoje", "amanhã", "27/04", "essa semana"). O modelo interpretou isso como falta de capacidade.

## Mudança (apenas no prompt)

Editar `supabase/functions/assistente-virtual/index.ts`, string `camada1`, na seção de regras de `list_reminders`:

Substituir a regra única atual por uma regra explícita cobrindo qualquer pergunta sobre lembretes/compromissos, com ou sem filtro de data:

- "Para qualquer pergunta sobre lembretes/compromissos do usuário ('quais meus lembretes', 'o que tenho hoje', 'compromissos de amanhã', 'agenda de 27/04', 'essa semana', etc.), SEMPRE chame `list_reminders()` primeiro. Nunca diga que não tem acesso — você tem."
- "Depois de receber a lista, filtre você mesmo pelo período que o usuário pediu (interpretando 'hoje', 'amanhã', '27/04', 'segunda', etc. em America/Sao_Paulo). Formate em bullets markdown com horário em negrito, conforme o padrão da seção LAYOUT."
- "Se a lista filtrada vier vazia, responda curto: 'Nada agendado para <período>.' Não invente compromissos."

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts` (somente texto da `camada1`)

## Resultado esperado

"Quais são meus compromissos do dia 27/04?" → Júlia chama `list_reminders()`, filtra pelos que caem em 27/04, e responde:

```
Seus compromissos de 27/04:
- **09h00** Reunião cliente
- **14h30** Dentista
```

Ou, se vazio: "Nada agendado para 27/04."

## Fora do escopo

- Sem mudar ferramentas, schema, frontend, ou outras regras.

