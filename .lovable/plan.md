## Problema identificado
A falha está na camada da assistente em `supabase/functions/assistente-virtual/index.ts`, não no banco.

O comportamento incorreto vem de 3 pontos combinados:
1. A Júlia está misturando **pendentes** com **histórico de cancelados** em consultas genéricas como “tenho algum compromisso?” e “olhe toda a agenda”.
2. Depois, no fluxo de “deletar todos”, ela conta só os **pendentes** (`list_reminders`), mas confirma “os N compromissos acima”, mesmo quando a mensagem anterior mostrava também cancelados — por isso apareceu **1** quando você tinha visto **2 itens na tela**.
3. Em cancelamento por horário (“deletar compromisso das 14”), a lógica atual pode agir com base só nos pendentes visíveis internamente, sem desambiguar direito quando a conversa deixou o usuário olhando uma lista mista ou quando houver mais de um candidato real.

## Plano
### 1. Separar agenda atual de histórico
Ajustar o prompt e os guards para que perguntas genéricas como:
- “Tenho algum compromisso na agenda?”
- “Quais compromissos tenho em toda agenda?”
- “Esses são todos os compromissos?”

retornem **somente compromissos pendentes**.

O histórico de cancelamentos/remarcações só deve aparecer quando o usuário pedir explicitamente algo como:
- “o que foi cancelado?”
- “teve cancelamento?”
- “o que aconteceu com o compromisso X?”

### 2. Tornar “deletar todos” determinístico
No fluxo de apagar em massa, fazer a resposta final usar o **total real vindo de `list_reminders`** e deixar explícito que se trata de **compromissos pendentes**.

Exemplo esperado:
- “Confirma apagar todos os **2 compromissos pendentes** acima?”

Isso evita o erro de contar 1 enquanto a mensagem anterior mostrava 2 itens por ter misturado histórico.

### 3. Exigir desambiguação quando houver mais de um alvo possível
Reforçar a lógica server-side para cancelamento por horário/título:
- se houver **1 candidato real**, cancela direto;
- se houver **2+ candidatos reais**, a Júlia **não pode escolher sozinha**;
- ela deve listar as opções com título, data, horário e código curto do id, e perguntar qual delas cancelar.

Isso cobre casos como dois compromissos às 14h.

### 4. Adicionar um fallback server-side para não depender só do modelo
Como a resposta final do modelo ainda pode misturar histórico indevidamente, incluir um override no servidor para estes casos:
- consulta genérica de agenda → responder a partir de `lastPendingList` apenas;
- apagar todos → confirmar com a contagem exata dos pendentes;
- cancelamento ambíguo → responder com pedido de escolha, sem executar delete.

## Validação
Vou validar estes cenários após aplicar:
1. “Tenho algum compromisso na agenda? Olhe em toda a agenda” → listar só pendentes.
2. “Deletar todos” após essa listagem → confirmar o número correto de pendentes.
3. “Não” → manter tudo sem efeitos colaterais.
4. Criar novo compromisso e listar novamente → mostrar todos os pendentes corretos.
5. “Cancelar/deletar compromisso das 14” com 2 candidatos reais → pedir qual deles.
6. “Quais compromissos tenho em toda agenda?” depois de um cancelamento → listar só os pendentes restantes, sem confundir com histórico.
7. “O que foi cancelado?” → aí sim mostrar o histórico.

## Detalhes técnicos
- Arquivo principal: `supabase/functions/assistente-virtual/index.ts`
- Banco e RLS: sem mudanças necessárias
- `reminders-api`: em princípio não precisa alteração; o problema está na orquestração e formatação da resposta da assistente