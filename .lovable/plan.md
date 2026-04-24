## Problema

No turno "Dia 29/05 tenho treino às 11 e dentista às 14h" a Júlia respondeu:

> ✅ Pronto! O lembrete de **Treino** para **29/05 às 11h** foi agendado.
> Agora, quando quer ser avisado do **Dentista às 14h**?

Mas os logs mostram: `tools_called: ["check_reminder_conflict"]`, `operations: []`. O `create_reminder` **nunca foi chamado**, e o banco confirma — não existe nenhum lembrete para 29/05. Ela alucinou a confirmação.

Pior ainda: ela pulou a etapa de perguntar a antecedência do Treino e foi direto pedir a antecedência do Dentista, dando a falsa impressão de que o Treino já estava resolvido.

## Causa

O guard existente em `supabase/functions/assistente-virtual/index.ts` (linhas 1554-1578) só dispara quando a pergunta do usuário **bate na regex de "resposta de antecedência"** (`"15 minutos antes"`, `"na hora"`, etc.). 

Aqui o usuário deu a frase inicial com 2 compromissos. O fluxo correto seria:
1. `check_reminder_conflict` para o 1º compromisso → perguntar antecedência
2. (após resposta) `create_reminder` do 1º + `check_reminder_conflict` do 2º → perguntar antecedência
3. (após resposta) `create_reminder` do 2º

O modelo chamou só conflict para um deles, pulou a pergunta de antecedência do Treino, e respondeu "Pronto" como se tivesse criado. Não há guard que detecte esse caso.

## Correção

Adicionar um guard genérico **anti-alucinação de confirmação**: se a resposta final do modelo contém frases de confirmação ("Pronto", "agendado", "Te aviso", "Criado", "lembrete... foi") **mas `create_reminder` (com `ok:true`) NÃO foi executado neste turno**, bloquear a resposta e forçar uma correção.

Local: `supabase/functions/assistente-virtual/index.ts`, dentro do loop de iterações, **antes** de `resposta = (msg?.content ?? "").trim()` na linha 1580.

Lógica:

```ts
const finalText = (msg?.content ?? "").trim();
const confirmRegex = /\b(pronto|agendad[oa]|criad[oa]|te aviso|aviso (você|voce)|foi (agendad|criad|adicionad)|lembrete .* foi)\b/i;
const createSucceeded = opResults.some(o => o.tool === "create_reminder" && o.ok);
const deleteSucceeded = opResults.some(o => o.tool === "delete_reminder" && o.ok);
const claimsConfirmation = confirmRegex.test(finalText);

if (claimsConfirmation && !createSucceeded && !deleteSucceeded && iter < 5) {
  // log + push system message bloqueando e forçando o fluxo correto
  messages.push({
    role: "system",
    content:
      `BLOQUEIO CRÍTICO: você respondeu confirmando ("${finalText.slice(0,80)}…") mas NÃO chamou create_reminder/delete_reminder neste turno. ` +
      `PROIBIDO confirmar criação/cancelamento sem operação executada. ` +
      `Releia o pedido original do usuário. Se você ainda precisa perguntar a antecedência, NÃO confirme nada — apenas pergunte a antecedência do PRIMEIRO compromisso pendente, emita [JULIA_CHIPS:lead_time] e pare. Se você já tem todos os dados, chame create_reminder AGORA.`,
  });
  continue;
}
```

Isso fecha o buraco: qualquer "Pronto/agendado/Te aviso" sem operação real força um retry corretivo.

Atualizar também o system prompt (perto do bloco "REMARCAR = DELETE + CREATE ATÔMICOS", linha ~255) com uma regra explícita:

> **PROIBIÇÃO ABSOLUTA**: nunca diga "Pronto", "agendado", "Te aviso" ou "criado" sem ter recebido `created_id` do `create_reminder` no MESMO turno. Se você só chamou `check_reminder_conflict`, sua única ação válida é PERGUNTAR a antecedência (com `[JULIA_CHIPS:lead_time]`) — nunca confirmar.

Por fim, redeploy do edge function `assistente-virtual`.

## Validação

Repetir o cenário:
1. Apagar os lembretes de 28/04 (opcional) e enviar: "Dia 29/05 tenho treino às 11 e dentista às 14h"
2. Esperado: Júlia chama `check_reminder_conflict` para o Treino e responde **só** "Falta combinar o aviso de Treino às 11h. Quando quer ser avisado?" + chips. **Sem** "Pronto".
3. Responder "15 minutos antes" → `create_reminder` do Treino é executado, depois pede antecedência do Dentista.
4. Responder "15 minutos antes" → `create_reminder` do Dentista executado.
5. "Mostre todos os compromissos do dia 29" → lista os dois.

Caso o modelo ainda tente alucinar, o novo guard captura e força o fluxo certo no mesmo turno.
