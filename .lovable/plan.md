

# Júlia: tratar múltiplos compromissos em uma única frase

## Problema

Quando o usuário diz **"Tenho treino na segunda às 11h e instagram às 16"** (dois compromissos numa frase só), Júlia processa apenas o primeiro (treino) e ignora o segundo (instagram). Isso acontece porque o system prompt em `assistente-virtual/index.ts` foi escrito assumindo **um compromisso por mensagem** — manda emitir o marcador `[JULIA_CHIPS:lead_time]` e parar, então o segundo compromisso some.

Confirmado no print: a Júlia respondeu pedindo a antecedência só do treino, criou o lembrete do treino, e nunca mais mencionou o Instagram.

## O que vou ajustar

Editar **somente o system prompt** dentro de `supabase/functions/assistente-virtual/index.ts` (camada1) para adicionar uma regra explícita de **fila de compromissos pendentes**:

1. **Detecção:** logo no início, antes de qualquer ação, identificar TODOS os compromissos com horário marcado mencionados na mensagem do usuário (separados por "e", vírgula, "também", "depois", etc.).

2. **Processamento sequencial — UM de cada vez:**
   - Pega o primeiro compromisso da fila.
   - Pergunta a antecedência com o marcador `[JULIA_CHIPS:lead_time]` (regra atual mantida).
   - Após o usuário responder a antecedência, faz `check_reminder_conflict` + `create_reminder` desse compromisso.
   - Na confirmação, **se ainda houver compromissos pendentes na fila**, acrescenta uma linha tipo: *"Falta combinar o aviso de **Instagram às 16h**. Quando quer ser avisado?"* seguido do marcador `[JULIA_CHIPS:lead_time]` em linha separada.
   - Repete até a fila esvaziar.

3. **Atalho "X antes de Y" repetido:** se o usuário já disser a antecedência de cada compromisso na mesma frase ("me avise 1h antes do treino e na hora do instagram"), processa todos de uma vez sem chips, criando os lembretes em sequência (cada um com seu próprio `check_reminder_conflict` + `create_reminder`).

4. **Confirmação final consolidada:** quando a fila esvazia, fecha com um resumo curto listando os 2+ avisos criados.

5. **Memória da fila:** como o backend é stateless entre turnos, instruir o modelo a **manter a fila visível no texto da resposta** (a frase "Falta combinar o aviso de **Instagram às 16h**") — assim, no próximo turno, o histórico carrega esse contexto e a Júlia não esquece.

## Arquivo alterado

- `supabase/functions/assistente-virtual/index.ts` — apenas a string `camada1` (system prompt). Sem mudanças em ferramentas, schema, tabelas ou frontend.

## Resultado esperado

- "Tenho treino na segunda às 11h e instagram às 16" → Júlia detecta 2 compromissos, pergunta antecedência do treino com chips, cria, depois pergunta antecedência do instagram com chips, cria, e fecha confirmando os dois.
- "Me avise 30min antes do treino das 11h e na hora do instagram das 16h" → Júlia cria os dois direto, sem chips, e confirma.

## Fora deste escopo

- Tarefas avulsas continuam direto como hoje.
- Nenhuma alteração em `reminders-api`, schema ou UI dos chips.
- Não vou mexer no fluxo de Google Calendar.

