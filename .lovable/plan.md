

# Júlia: checar conflito também para o 2º+ compromisso da fila

## Problema

Hoje a Júlia, ao processar o 1º compromisso da fila, faz `check_reminder_conflict` antes de criar e avisa o usuário se houver conflito (ex.: "treino às 11h" → conflitou → trocou pra 12h). Mas ao avançar para o 2º compromisso da fila ("instagram às 16h"), ela pula direto para "Quando quer ser avisado?" + chips, sem nunca rodar `check_reminder_conflict` para esse horário. Resultado: se houver conflito no 16h, o usuário só vai descobrir depois que o lembrete for criado.

A regra de detecção de conflito (linha 237 do prompt) só dispara "imediatamente antes de `create_reminder`". Como, para o 2º item, primeiro a Júlia pergunta a antecedência (e só depois chama `create_reminder`), o aviso de conflito acaba acontecendo num momento ruim — ou nem aparece, dependendo do raciocínio do modelo.

## Mudança

Editar **somente o system prompt** (`camada1`) em `supabase/functions/assistente-virtual/index.ts`, na seção "MÚLTIPLOS COMPROMISSOS NA MESMA MENSAGEM", para adicionar uma regra explícita:

**Antes de pedir a antecedência do PRÓXIMO compromisso da fila** (Linha C/D atuais), a Júlia DEVE primeiro chamar `check_reminder_conflict` para o horário desse compromisso (window_minutes=15).

- Se houver conflito: a resposta naquele turno NÃO mostra os chips. Em vez disso, ela lista o conflito do 2º compromisso e pergunta "Quer marcar mesmo assim ou prefere outro horário?". A Linha A (confirmação do anterior) continua presente. O nome+horário do compromisso pendente continua visível na resposta para preservar a memória da fila. Os chips só aparecem depois que o horário definitivo do 2º compromisso estiver decidido.
- Se não houver conflito: segue o fluxo atual (Linha A + Linha C "Falta combinar..." + Linha D `[JULIA_CHIPS:lead_time]`).

A mesma regra vale para o 3º, 4º compromisso, etc. — sempre que a fila avançar para um próximo item, checar conflito **antes** de perguntar a antecedência.

## Arquivo alterado

- `supabase/functions/assistente-virtual/index.ts` — apenas a string `camada1`, dentro do bloco "MÚLTIPLOS COMPROMISSOS NA MESMA MENSAGEM" (linhas ~225-235).

## Resultado esperado

Cenário do print: "Tenho treino na segunda às 11h e instagram às 16"
- Trata treino: conflito → resolve para 12h → cria.
- **Antes de perguntar antecedência do instagram às 16h**, roda `check_reminder_conflict` para 16h. Se conflitar, avisa o usuário e espera ele decidir o horário antes de mostrar os chips. Se não conflitar, mostra os chips normalmente.

## Fora do escopo

- Sem mudanças em ferramentas, schema, `reminders-api`, ou frontend.
- Sem mudança no fluxo de Google Calendar.

