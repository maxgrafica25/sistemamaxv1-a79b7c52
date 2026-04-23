
# Júlia: herdar a data da lista anterior no servidor e nunca mostrar lembretes fora desse escopo

## Diagnóstico

O problema continua porque o filtro por data ainda depende demais do modelo no segundo turno.

No fluxo atual:
1. Na pergunta inicial (“o que tenho dia 27?”), a tool pode trazer a lista filtrada e a resposta sai correta.
2. No turno seguinte (“altera o treino de 13 para 11h e cancela o das 14h”), começa uma nova execução da função.
3. Nessa nova execução, `lastDateFilter` nasce `null`.
4. Se o modelo chamar `list_reminders()` sem `from_date/to_date`, o servidor recarrega todos os pendentes.
5. Quando o delete falha por `uuid_not_in_session`, o fallback usa `lastPendingList` já contaminada com a lista global, então aparecem horários de outros dias.

Ou seja: o bug real não é só “filtro não aplicado”; é que o **contexto do dia 27 não é reconstruído no servidor no turno seguinte**.

## O que vou ajustar

### 1. Inferir o “dia em contexto” a partir do histórico antes de qualquer tool
No início de `supabase/functions/assistente-virtual/index.ts`, vou extrair do `historico` a última data explícita da listagem anterior da Júlia, por exemplos como:
- `Seus pendentes para 27/04:`
- `Aqui estão os pendentes do dia 27/04:`

Essa data vira um `inheritedDateFilter` no formato `YYYY-MM-DD`.

Regra:
- se o usuário atual **não citar nova data**, e a mensagem parecer continuação de edição/cancelamento/remarcação (“o de 13”, “cancela o das 14h”, “troca o treino”), o servidor assume o mesmo dia da última lista;
- se o usuário citar nova data explicitamente, a nova data prevalece.

### 2. Aplicar esse filtro herdado automaticamente em `list_reminders`
Na execução de `list_reminders`:
- se vier `from_date/to_date`, usa o que a tool mandou;
- se não vierem, mas existir `inheritedDateFilter` e a sessão for de edição/cancelamento, o servidor injeta esse filtro automaticamente;
- `lastDateFilter` passa a ser preenchido também por esse caminho herdado, não só quando o modelo manda os parâmetros.

Assim, mesmo se o modelo esquecer de reenviar a data, o servidor mantém a consulta presa ao dia certo.

### 3. Filtrar `available_reminders` do guard por data antes de devolver erro
Hoje, no `delete_reminder`, quando o UUID não foi verificado:
- ele devolve `available_reminders: lastPendingList` crua.

Vou mudar para:
- montar uma lista filtrada por `lastDateFilter` / `inheritedDateFilter` antes de retornar `uuid_not_in_session`;
- isso garante que o retry do modelo já receba apenas os lembretes do dia correto.

Resultado: a própria resposta de erro intermediária deixa de poluir o modelo com lembretes de outros dias.

### 4. Corrigir o fallback final para sempre re-filtrar, mesmo se `lastPendingList` já estiver preenchida
Hoje o bloco final de override só re-filtra se `lastPendingList.length === 0`.

Vou ajustar para:
- sempre aplicar uma função única de filtro por data ao `lastPendingList` antes de montar a mensagem final;
- se necessário, refazer o GET, mas sem depender de a lista estar vazia.

Isso corrige exatamente o caso do screenshot: lista já preenchida, porém com escopo errado.

### 5. Centralizar a lógica de filtro em helper único
Para evitar divergência, vou criar helpers internos como:
- `extractDateContextFromHistory(...)`
- `applyDateFilterToReminderList(...)`
- `resolveActiveDateFilter(...)`

Esses helpers serão usados em:
- `list_reminders`
- retorno de `uuid_not_in_session`
- fallback final “não consegui identificar exatamente quais lembretes alterar”

Assim o mesmo critério vale em todos os pontos.

### 6. Reforçar o prompt, mas sem depender dele
Vou manter o prompt instruindo a usar a data da lista anterior, mas o comportamento correto ficará garantido no servidor.

Objetivo:
- o prompt ajuda;
- o servidor assegura.

## Arquivo a alterar

- `supabase/functions/assistente-virtual/index.ts`

## Resultado esperado

Para este fluxo:
1. “olha pra mim o que tenho dia 27”
2. Júlia lista só os itens de 27/04
3. “Altera o treino de 13 para 11h e cancela o das 14h”

Com a correção:
- a busca de candidatos fica presa ao dia 27;
- se ela não localizar com segurança, o fallback mostra **somente** os lembretes de 27/04;
- nunca mais aparecem itens de 24, 25, 28 etc. nesse contexto.

## Fora do escopo

- Sem mudança de schema
- Sem migration
- Sem mexer no frontend
- Sem trocar modelo