

# Corrigir template string não fechada em `assistente-virtual`

## Bug

Em `supabase/functions/assistente-virtual/index.ts`, a template literal `camada1` abre na linha 163 (`` const camada1 = ` ``) mas **nunca é fechada**. A linha 205 está em branco e a linha 207 já começa `const camada2 = ...` — sem o backtick de fechamento, todo o código de `camada2` em diante vira parte da string `camada1` (até algum backtick acidental mais adiante no arquivo), e o resto do arquivo deixa de ser código executável.

Sintomas observados:
- Júlia responde *"Não sou uma agenda ou assistente pessoal..."* — o prompt está corrompido e a seção de ferramentas/regras é quebrada.
- Provavelmente nenhum tool call é emitido porque a declaração `tools` no payload do Gemini também ficou dentro da string.

## Correção

Arquivo único: `supabase/functions/assistente-virtual/index.ts`. Adicionar `` `; `` ao final da linha 204 (após `"quais meus lembretes", chame list_reminders e formate em lista curta.`), fechando a template string antes da declaração de `camada2`.

Diff conceitual:

```text
204:   - Para "quais meus lembretes", chame list_reminders e formate em lista curta.
205: + `;
206:
207:     const camada2 =
```

Nada mais muda. Sem alteração em schema, RLS, prompt content, tools ou `reminders-api`.

## Validação após deploy

1. *"Oi"* → Júlia se apresenta normalmente.
2. *"Me lembre do dentista amanhã às 14h"* → confirma criação e grava em `reminders` com `category="assistente"`.
3. *"Quais meus lembretes?"* → lista pendentes.
4. *"Cancele o lembrete do dentista"* → exclui.
5. Conferir nos logs da Edge Function que não há mais `SyntaxError` nem fallback de prompt corrompido.

## Risco

Mínimo — correção de 1 caractere que restaura a integridade sintática do arquivo.

