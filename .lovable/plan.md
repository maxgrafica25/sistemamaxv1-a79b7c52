
# Corrigir a Júlia que parou de responder

## Problema identificado

A função `assistente-virtual` nem está iniciando. O erro real do backend é:

```text
worker boot error: Uncaught SyntaxError: Identifier 'body' has already been declared
at .../assistente-virtual/index.ts:951:15
```

Na função `callGateway`, dentro do mesmo bloco do `for`, existe:
- `const body` para montar o payload da requisição ao gateway
- outro `const body` para ler o texto de erro da resposta

Isso quebra o parse do arquivo inteiro. Resultado:
- a função não sobe
- a chamada do frontend vira `Failed to fetch`
- a Júlia responde “Não consegui responder agora” ou fica sem resposta

## O que vou ajustar

### 1. Corrigir a colisão de variável em `callGateway`
No arquivo `supabase/functions/assistente-virtual/index.ts`:
- renomear o primeiro `body` para algo como `requestBody`
- renomear o segundo `body` para algo como `errorText`

Trecho afetado:
- bloco da função `callGateway(...)`, perto das linhas 998–1015

### 2. Revisar o bloco recém-alterado para evitar nova quebra sintática
Fazer uma revisão pontual no mesmo trecho para garantir que:
- `JSON.stringify(...)` use a variável renomeada correta
- o log de erro use a variável de texto correta
- a lógica de `forceNoTools` continue intacta

### 3. Validar a coerência do fluxo sem mudar comportamento
Manter exatamente a lógica aprovada anteriormente:
- loop com até 6 iterações
- chamada final com `tool_choice: "none"`
- fallback servidor-side com `opResults`

A correção aqui é só de sintaxe/boot, não de regra de negócio.

## Arquivo a alterar

- `supabase/functions/assistente-virtual/index.ts`

## Resultado esperado

Depois da correção:
- a função volta a iniciar normalmente
- o POST para `assistente-virtual` deixa de falhar com `Failed to fetch`
- a Júlia volta a responder no chat
- o fluxo novo de múltiplas iterações e resumo final volta a funcionar

## Fora do escopo

- Sem mudar prompt
- Sem mudar schema
- Sem migration
- Sem mexer no frontend
