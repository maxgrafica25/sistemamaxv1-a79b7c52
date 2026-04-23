

# Júlia: evitar duplicatas e desambiguar comandos de remarcar/cancelar

## Causa raiz

1. **Duplicatas silenciosas**: a regra "antes de criar, chame `list_reminders` e cheque título parecido" (linha 209 do prompt) está sendo ignorada na prática. Resultado: hoje há 2× "Treino às 11h" e 2 lembretes às 14h no banco do usuário.
2. **Confusão pra remarcar/cancelar**: quando o usuário diz "remarca o treino das 11" e existem 2 treinos das 11h, a Júlia devolve "qual deles?" — comportamento correto, mas só aconteceu porque a duplicata existiu.
3. **Horário errado**: "instagram às 16h" foi salvo como 14h em UTC errado — pode ter sido o modelo confundindo o fuso ao processar múltiplos compromissos numa mesma frase.

## Mudanças (apenas no system prompt)

Editar `supabase/functions/assistente-virtual/index.ts`, string `camada1`:

### 1. Reforçar dedupe antes de `create_reminder` (substitui a linha 209 vaga)
Nova regra explícita e obrigatória:
- **ANTES** de toda chamada `create_reminder`, chamar `list_reminders` e procurar lembretes pendentes cujo título contém o mesmo assunto E `remind_at` está no mesmo dia.
- Se achar match, **NÃO criar**. Listar o(s) existente(s) com horário e perguntar: "Já existe **<título>** marcado pra <dia/hora>. Quer (a) substituir, (b) manter os dois, ou (c) cancelar essa nova?"
- Só criar duplicata se o usuário escolher explicitamente (b).

### 2. Regra de fuso ao processar múltiplos compromissos
Acrescentar à seção "MÚLTIPLOS COMPROMISSOS" uma frase explícita: "Sempre calcule `remind_at` em America/Sao_Paulo. Para cada compromisso da lista, recalcule do zero — não reaproveite o offset/horário do anterior. Confira mentalmente: se o usuário disse '16h', o ISO deve terminar em `T16:00:00-03:00` (ou `T19:00:00Z`), nunca `T14:00:00`."

### 3. Comando de remarcar/cancelar com desambiguação automática
Nova regra:
- Quando o usuário pedir "remarca/cancela o <X> das <hora>", chamar `list_reminders`, filtrar por título contendo `<X>` E horário próximo a `<hora>` (±2h ou mesmo dia).
- Se houver 1 match: executar direto (delete + create no caso de remarcar).
- Se houver 2+ matches: listar com **id curto** (últimos 4 caracteres), título e horário, e perguntar qual.
- Se 0 matches: dizer claramente "Não achei nenhum <X> por volta das <hora> nos seus pendentes."

### 4. Limpeza dos lembretes duplicados existentes do usuário
Via migration SQL (1x), remover as duplicatas atuais que travaram a conversa do print:
```sql
-- Mantém o mais recente de cada par título+remind_at; deleta os antigos
DELETE FROM public.reminders r
USING public.reminders r2
WHERE r.user_id = r2.user_id
  AND r.title = r2.title
  AND r.remind_at = r2.remind_at
  AND r.created_at < r2.created_at
  AND r.is_completed = false
  AND r2.is_completed = false;
```

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts` (apenas string `camada1`, sem mexer em ferramentas/schema)
- 1 migration SQL para limpar duplicatas existentes

## Resultado esperado

- "Tenho treino às 11h e instagram às 16h" → cria os dois com horários certos, sem duplicar se você pedir de novo.
- "Remarca o treino das 11 pra 11:15" → acha o único treino das 11, deleta, cria novo às 11:15 sem perguntar "qual?".
- "Cancela o compromisso das 14h" → se houver só um, cancela direto; se houver vários, lista pra escolher.

## Fora do escopo

- Sem mudanças em `reminders-api`, `gcal-sync-worker`, frontend ou schema da tabela `reminders`.
- Sem mexer no fluxo de chips de antecedência.

