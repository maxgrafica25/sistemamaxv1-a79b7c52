## Problema

Quando a Júlia lista os pendentes e o usuário pergunta **"Só tenho esse compromisso em toda agenda?"** (uma confirmação sobre a lista que ela acabou de mostrar), ela está chamando `list_cancelled_reminders` e despejando o histórico de cancelamentos/remarcações como se fosse parte da agenda.

Comportamento esperado: se a pergunta é só uma **confirmação dos pendentes** ("é só isso?", "só tenho esse?", "esses são todos?", "não tem mais nada?"), ela deve responder **apenas com base nos pendentes** (a lista que ela mesma acabou de mostrar) — sem puxar cancelados. Cancelados só entram quando o usuário usa palavras explícitas: `cancelado, deletado, apagado, removido, excluído, "o que aconteceu com X"`.

## Causa raiz (`supabase/functions/assistente-virtual/index.ts`)

1. **Regra ambígua no prompt (linha 230)**: a tool `list_cancelled_reminders` lista entre os gatilhos a frase `"eu tinha algo?"`, e o modelo está generalizando isso pra qualquer pergunta de confirmação ("só tenho esse?"). 
2. **Regra "AGENDA = SOMENTE PENDENTES" (linha 258)** menciona `"esses são todos?"` mas não cobre as variantes `"só tenho esse?"`, `"é só isso?"`, `"não tem mais nada?"`, `"só esse mesmo?"`.
3. **Sem guard reverso**: existe um guard que **força** `list_cancelled_reminders` quando há palavras-chave de cancelamento, mas **não existe guard** que **bloqueie** `list_cancelled_reminders` quando a pergunta é puramente de confirmação dos pendentes (sem palavras de cancelamento).

## Plano

### 1. Refinar o prompt (regra inviolável de "AGENDA = SOMENTE PENDENTES")
- Expandir a lista de gatilhos de confirmação na linha 258 incluindo: `"só tenho esse?"`, `"é só isso?"`, `"só esse mesmo?"`, `"não tem mais nada?"`, `"é só esse compromisso?"`, `"só tenho esses?"`.
- Reforçar: **se a pergunta NÃO contém literalmente `cancelado|cancelei|cancelamento|deletado|deletei|apagado|apaguei|removido|excluído|"o que aconteceu"`, NUNCA chame `list_cancelled_reminders` e NUNCA mostre seção "Histórico de cancelamentos/remarcações"**. Confirmação de pendentes responde com a lista de pendentes do turno anterior (ou re-chama `list_reminders`).

### 2. Remover o gatilho ambíguo da descrição da tool (linha 230)
- Tirar o `"eu tinha algo?"` da descrição de `list_cancelled_reminders`. Essa frase, sozinha, sem palavra de cancelamento, é genérica demais e está fazendo o modelo chamar a tool errada. Manter apenas gatilhos que tenham palavras explícitas: `cancelado, cancelei, cancelamento, deletado, deletei, apagado, apaguei, removido, excluído, "o que aconteceu com X"`.

### 3. Adicionar guard reverso (bloqueia chamada indevida de cancelados)
No loop de execução de tools (perto da linha 1195 onde o handler `list_cancelled_reminders` é executado), adicionar um guard server-side:
- Se o modelo tenta chamar `list_cancelled_reminders` **e** a pergunta do usuário **NÃO** contém nenhuma das palavras-chave de cancelamento (`cancel|delet|apag|remov|exclu[ií]|aconteceu`), **bloquear a execução** retornando um erro instrutivo: `"BLOQUEIO: a pergunta do usuário não menciona cancelamento/deleção. NÃO chame list_cancelled_reminders. Para confirmar a agenda, use apenas os pendentes (re-chame list_reminders se necessário) e responda com base neles."`.
- Isso garante que mesmo se o prompt falhar, a chamada errada nunca chega a despejar histórico no usuário.

### 4. Redeploy
- Redeploy do edge function `assistente-virtual`.

## Resultado esperado

- "Me mostre todos os compromissos da agenda" → lista pendentes ✓
- "Só tenho esse compromisso em toda agenda?" → "Sim, é o único pendente." (sem histórico) ✓
- "Algo foi cancelado?" / "O que apaguei hoje?" → chama `list_cancelled_reminders` e mostra histórico ✓
- "Deletar todos" → fluxo de mass deletion (inalterado) ✓
