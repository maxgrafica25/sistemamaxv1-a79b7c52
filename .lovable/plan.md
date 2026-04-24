## Problema

A Júlia respondeu "Tive um problema interno" quando o usuário pediu "Ok! Então me mostra todos cancelados". Os logs mostram o erro real: `iter is not defined`.

São **dois bugs** no guard reverso adicionado na última correção (`supabase/functions/assistente-virtual/index.ts`, linhas 1195-1212):

### Bug 1 — `iter is not defined` (crash)
O `console.log` dentro do handler de `list_cancelled_reminders` referencia a variável `iter`, que só existe dentro do loop `for (let iter...)` na linha 1411. Como o handler é parte de uma função `executeTool` definida fora do loop, `iter` não está em escopo → `ReferenceError` → resposta genérica de erro.

### Bug 2 — Regex não cobre plurais
O regex `/\b(cancel(ado|ei|ou|amento|ar|a)|delet(ado|ei|ou|ar|a)|apag(ado|uei|ou|ar|a)|remov(ido|i|eu|er|e)|exclu[ií](do|i|iu|r|a)|aconteceu|aconteceram)\b/i` exige `\b` (word-boundary) imediatamente após "cancelado". Como o `s` do plural NÃO é word-boundary, palavras como **"cancelados"**, **"deletados"**, **"apagados"**, **"removidos"**, **"excluídos"** falham no teste — exatamente o que o usuário escreveu ("me mostra todos cancelados").

Mesmo se o Bug 1 fosse corrigido sozinho, o guard ainda bloquearia incorretamente o pedido legítimo do usuário.

## Correção

Editar `supabase/functions/assistente-virtual/index.ts` (linhas 1195–1212):

1. **Remover `iter`** do `console.log` do guard (substituir por `pergunta_preview` apenas, ou usar `"guard"` como marcador). Isso elimina o crash.
2. **Adicionar `s?` opcional** após cada terminação verbal/adjetiva no regex para cobrir plurais:
   - `cancel(ado|ei|ou|amento|ar|a)s?`
   - `delet(ado|ei|ou|ar|a)s?`
   - `apag(ado|uei|ou|ar|a)s?`
   - `remov(ido|i|eu|er|e)s?`
   - `exclu[ií](do|i|iu|r|a)s?`

Após editar, redeployar a função `assistente-virtual`.

## Validação

Testar o mesmo fluxo:
1. "Me mostre todos os compromissos da agenda" → só pendentes (já funciona).
2. "Só tenho esse compromisso em toda agenda?" → confirmação com base em pendentes (já funciona).
3. "Ok! Então me mostra todos cancelados" → deve listar os cancelados (atualmente quebra).
