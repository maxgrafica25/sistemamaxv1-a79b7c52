

# Júlia: forçar retry automático quando o guard rejeitar UUID

## O que aconteceu

Conversa das 15:34 ("troca compromisso das 11 para 11h30 e cancelar o das 15h15"):

1. Júlia chamou `list_reminders` na iteração atual e recebeu os 10 pendentes corretos.
2. Mesmo assim, gerou dois UUIDs inventados (`46efcc9b-...` e `4ff7c6b4-...`) para o `delete_reminder` em vez de copiar `76590693-...` (Treino 11h15) e `1cd24fd0-...` (Treino 15h15) que estavam no JSON da tool.
3. Guard rejeitou os dois (✅ funcionou).
4. Júlia **não tentou de novo** — pulou pra resposta "me confirma qual era?".
5. Mas o `create_reminder` do novo Treino 11h30 rodou normalmente.

Resultado: usuário ficou com Treino 11h15 antigo + Treino 11h30 novo (duplicata) + Treino 15h15 não cancelado.

## Por que o prompt não bastou

A instrução "se vier {error} de uuid_not_in_session, chame list_reminders e tente de novo" está enfiada num parágrafo de 6 linhas. O modelo lê e ignora. Precisa de um mecanismo do servidor, não outra regra de prompt.

## Correções

### 1. Auto-retry no servidor: quando o guard rejeitar, devolver os IDs corretos junto com o erro

Arquivo: `supabase/functions/assistente-virtual/index.ts`

Quando `delete_reminder` for rejeitado por `uuid_not_in_session`:
- Em vez de devolver só `{ error: "..." }`, devolver `{ error: "...", available_reminders: [...] }` com a lista atual de pendentes (mesmo formato do `list_reminders`, com id + title + event_at).
- Isso garante que, na próxima volta do loop de tool-calling, o modelo **tenha o JSON com os IDs reais imediatamente disponível** sem precisar decidir chamar `list_reminders` de novo.
- O prompt vira: "se vier `uuid_not_in_session`, escolha o id correto da lista `available_reminders` que veio no mesmo retorno e chame `delete_reminder` de novo".

### 2. Bloquear `create_reminder` que faz parte de um "remarcar" se o `delete_reminder` correspondente falhou

O caso clássico ("trocar X das 11 para 11h30") é semanticamente um par: 1 delete + 1 create. Se o delete falha, o create vira duplicata. Hoje não tem nenhuma proteção.

Solução pragmática (sem inventar API nova): no prompt, regra inviolável:
- "REMARCAR = DELETE + CREATE atômicos: se o `delete_reminder` da peça antiga falhar (qualquer erro), você NÃO pode chamar `create_reminder` da peça nova. Primeiro resolva o delete (retry com id correto), só depois crie. Se mesmo após retry o delete falhar, NÃO crie nada e diga ao usuário."

Isso é regra de prompt mas é curta, na frente, e fácil do modelo seguir porque o gatilho é claro (erro do delete → não chamar create).

### 3. Forçar retry estrutural no loop de tool-calling

Arquivo: `supabase/functions/assistente-virtual/index.ts`

No loop, quando uma chamada `delete_reminder` retorna `uuid_not_in_session`:
- Setar uma flag `mustRetryDelete = true` na iteração.
- Se o modelo na PRÓXIMA volta tentar `create_reminder` antes de um novo `delete_reminder` bem-sucedido para o mesmo "slot lógico", **bloquear o create** com erro: `{ error: "delete pendente — resolva o delete antes de criar para evitar duplicata" }`.
- Heurística simples para "mesmo slot": comparar `title` (case-insensitive, sem acento) do create proposto contra o que o usuário pediu para remarcar. Se for parecido (ex: ambos "treino"), bloquear.

Como detectar que é "remarcar" e não criar puro? Olhar a mensagem original do usuário: se contém verbos `troca/trocar/remarca/remarcar/muda/mudar de ... para ...`, marcar a sessão como "modo remarcar" e ativar o bloqueio do create até o delete passar.

### 4. Limpar a duplicata criada nesta sessão (limpeza pontual)

A migração não precisa, mas via tool de banco: cancelar o `Treino` `event_at = 2026-04-27 14:30:00 UTC-3` que ficou duplicado. Posso fazer isso direto via SQL no momento da execução (sem migration permanente).

### 5. Melhorar resposta ao usuário quando delete falha mesmo após retry

Hoje a Júlia diz "Não consegui apagar o Treino das 11h15 — me confirma qual era?". Isso confunde porque ela **acabou de listar pra ele**. Trocar para:
- "Tive um problema interno ao tentar apagar o Treino das 11h15. Tenta de novo dizendo só 'cancelar o treino das 11h15'?"

Sem pedir confirmação que o usuário não tem como dar de forma diferente.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts` (guard devolve `available_reminders`, bloqueia `create_reminder` em modo remarcar, ajusta prompt)
- limpeza SQL pontual: cancelar a duplicata `Treino 11h30` criada nas 15:34 (id `53cf6d83-...`)

## Resultado esperado

Próxima vez que o usuário disser "trocar treino das 11 para 11h30":
1. `list_reminders` → ids reais carregados.
2. `delete_reminder` com UUID inventado → guard rejeita E devolve `available_reminders`.
3. Modelo escolhe o id correto do `available_reminders` no mesmo turno → delete passa.
4. `create_reminder` do novo Treino 11h30 → ok.

Se mesmo assim o modelo insistir em UUID inventado, o `create_reminder` é bloqueado e o usuário recebe mensagem clara em vez de duplicata.

## Fora do escopo

- Sem mudar schema.
- Sem mexer em conflito/dedupe.
- Sem mudar UI.

