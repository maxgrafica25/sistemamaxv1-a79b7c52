
# Júlia: garantir que remarcar/cancelar apague o item certo

## O que aconteceu

A troca foi só pela metade:

- o novo lembrete das **11h15** foi criado;
- mas o lembrete antigo das **11h** e o das **16h** continuaram existindo.

Pelos logs, houve `delete_reminder` duas vezes e `create_reminder` uma vez, mas a lista final ainda mostra os itens antigos. Isso indica dois problemas combinados:

1. **A Júlia não ancorou o comando ao dia 27/04** no follow-up “trocar o treino das 11…” e “cancelar o compromisso das 16h”.
2. **O endpoint `DELETE` hoje responde sucesso mesmo quando não apagou nada**, então a IA acha que removeu, mas pode ter enviado id errado/vazio e ninguém percebe.

## Mudanças

### 1. Tornar o `DELETE` confiável no backend
Arquivo: `supabase/functions/reminders-api/index.ts`

- Validar o `id` recebido no `DELETE`.
- Fazer o delete retornar o registro apagado (`.delete().select("id").maybeSingle()` ou equivalente).
- Se nenhum registro for removido, responder **404 / "lembrete não encontrado"** em vez de `204`.
- Manter o filtro por `user_id`, mas sem mascarar “não achei” como sucesso.

Resultado: a Júlia só poderá confirmar exclusão quando a exclusão realmente acontecer.

### 2. Ensinar a Júlia a herdar o contexto da lista anterior
Arquivo: `supabase/functions/assistente-virtual/index.ts`

Adicionar regra explícita no `camada1`:

- Se a mensagem anterior da própria Júlia foi uma **lista filtrada por data** (“Seus pendentes para 27/04”), e o usuário responder com referências curtas como:
  - “o treino das 11”
  - “o compromisso das 16h”
  - “troca esse”
  - “cancela o das 16”
  
  então a data implícita deve ser **a mesma da lista anterior**, salvo se o usuário disser outra data.

Isso faz “trocar o treino das 11 para 11h15 e cancelar o compromisso das 16h” mirar os itens de **27/04**, não qualquer lembrete de 11h/16h em outra data.

### 3. Endurecer a regra de seleção do alvo antes de apagar
Arquivo: `supabase/functions/assistente-virtual/index.ts`

Ajustar as regras de remarcar/cancelar para:

- chamar `list_reminders`;
- primeiro filtrar pelo **dia em contexto**;
- depois filtrar por **horário citado**;
- depois usar assunto/título como refinamento;
- só chamar `delete_reminder` quando houver **1 match exato**.

Se houver:
- **0 matches** → dizer que não encontrou naquele dia/horário;
- **2+ matches** → listar opções e pedir escolha;
- nunca apagar “por aproximação” quando o alvo não estiver unívoco.

### 4. Exigir uso de id exato retornado por `list_reminders`
Arquivo: `supabase/functions/assistente-virtual/index.ts`

Adicionar instrução clara:

- `delete_reminder` só pode ser chamado com o **UUID exato** vindo do `list_reminders` da mesma iteração;
- nunca inventar, truncar, reaproveitar ou inferir id;
- se o `DELETE` voltar erro/404, a Júlia deve assumir falha e responder que não conseguiu apagar aquele item.

### 5. Melhorar observabilidade para confirmar a correção
Arquivo: `supabase/functions/assistente-virtual/index.ts`

- Melhorar logs dos tools para incluir nome + argumentos relevantes (especialmente `id`, horário e título alvo), sem expor nada sensível ao usuário.
- Assim, numa próxima ocorrência, fica claro **qual id** ela tentou apagar.

## Arquivos alterados

- `supabase/functions/reminders-api/index.ts`
- `supabase/functions/assistente-virtual/index.ts`

## Resultado esperado

Fluxo esperado após a correção:

1. Usuário pergunta: “Quais são meus compromissos do dia 27/04?”
2. Júlia lista os itens de 27/04.
3. Usuário responde: “Quero trocar o treino das 11 para as 11h15 e cancelar o compromisso das 16h.”
4. Júlia:
   - entende que ambos os comandos se referem a **27/04**;
   - encontra os ids exatos do treino das 11h e do item das 16h;
   - apaga o treino das 11h;
   - cria o das 11h15;
   - apaga o das 16h;
   - só confirma se tudo realmente tiver dado certo.

## Fora do escopo

- Sem mudar schema da tabela `reminders`.
- Sem mudar frontend do chat.
- Sem alterar fluxo de chips de antecedência.
