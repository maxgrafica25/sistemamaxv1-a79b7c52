

# Júlia: aumentar limite de iterações de tools + fallback que mostra o que foi feito

## Diagnóstico (com base nos logs)

A operação **funcionou no banco** (logs 19:21):
1. `list_reminders` (iter 0) — listou tudo certo
2. `delete_reminder 77e2f837` (Treino 12h, motivo=rescheduled) — ✅
3. `check_reminder_conflict` + `create_reminder` (Treino 12h30) — ✅ (id 41380526)
4. `delete_reminder a6371060` (Teste Sistema 1 14h, motivo=user_cancelled) — ✅

Mas a Júlia respondeu: **"Não consegui finalizar a resposta. Tente novamente."**

## Causa raiz

`for (let iter = 0; iter < 3; iter++)` no loop de tools (linha 1026) limita a **3 iterações**. Cada round em que o modelo chama tools consome 1 iteração. Para "alterar X e cancelar Y" o modelo gastou:
- iter 0 → `list_reminders`
- iter 1 → `delete_reminder` (X antigo)
- iter 2 → `check_conflict` + `create_reminder` (X novo) + `delete_reminder` (Y)

Após a iter 2 o `continue` pula pra iter 3 → condição falsa → **loop sai sem dar ao modelo a iteração de geração de texto final**. `resposta` fica vazio → cai no fallback genérico.

Pior: o `OPERAÇÕES REALIZADAS NESTE TURNO` (resumo auditado que injetamos) foi adicionado mas o modelo nunca foi chamado pra lê-lo. Toda a auditoria virou inútil.

## Correções

### 1. Aumentar limite de iterações de 3 → 6
Operações compostas legítimas (remarcar + cancelar outro) precisam de até 4-5 rounds. 6 dá folga sem risco de loop infinito (cada chamada tem custo no gateway, então o próprio modelo tende a parar quando termina).

### 2. Garantir 1 iteração final SÓ pra texto, mesmo se atingir o limite
Se o loop termina por limite atingido E houve `opResults`, fazer **uma chamada extra ao gateway com `tool_choice: "none"`** forçando o modelo a gerar texto baseado no resumo auditado já injetado. Sem novas tools — só resposta final.

### 3. Fallback final melhorado quando ainda assim não houver resposta
Se mesmo após a chamada forçada não houver texto, e tivermos `opResults` com sucessos, **gerar resposta servidor-side** listando o que foi feito:
> "✅ Pronto! Operações realizadas:
> - Cancelei Treino das 12h00 (remarcado)
> - Criei Treino das 12h30 (aviso 12h15)
> - Cancelei Teste Sistema 1 das 14h00"
>
> Em vez do "Não consegui finalizar a resposta."

Isso usa os `opResults.detail` que já temos.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts`:
  - Linha 1026: `iter < 3` → `iter < 6`.
  - Após o loop, antes do fallback genérico: se `!resposta && opResults.length > 0`, fazer chamada extra ao gateway com `tool_choice: "none"` pra forçar texto.
  - Se ainda assim vazio, montar resposta servidor-side a partir de `opResults`.

## Resultado esperado

Mesmo cenário ("alterar treino das 12 para 12h30 e cancelar 14h"):
- Tools rodam (já funciona).
- Modelo tem iterações suficientes pra gerar resposta normal.
- Caso extremo: servidor formata texto baseado em `opResults`, usuário vê confirmação real do que foi feito em vez de mensagem de erro genérica.

## Fora do escopo

- Sem mudar schema, sem mudar tools, sem mudar prompt.
- Sem migration.

