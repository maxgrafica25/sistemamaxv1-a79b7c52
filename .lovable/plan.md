## Objetivo
Trocar o provedor de IA da edge function `assistente-virtual` do Lovable AI Gateway para a API oficial do Google Gemini, mantendo 100% da lógica de negócio, auth, ferramentas e acesso ao banco.

## Estratégia: usar o endpoint OpenAI-compatível do Gemini

O código atual depende fortemente do formato OpenAI (`messages` com `role: "tool"`, `tool_calls`, `tool_choice: "auto"`, etc.) — refatorar para o formato nativo do Gemini (`contents`/`functionCall`/`functionResponse`) seria invasivo e arriscado.

Felizmente o Google oferece um endpoint **OpenAI-compatible** que aceita exatamente o mesmo payload já usado hoje:

```
POST https://generativelanguage.googleapis.com/v1beta/openai/chat/completions
Authorization: Bearer ${GOOGLE_API_KEY}
```

Isso permite uma troca cirúrgica de ~10 linhas, sem mexer em system prompt, tools, executeTool, guards, etc.

## Mudanças no código (`supabase/functions/assistente-virtual/index.ts`)

### 1. Secret
- Trocar `const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;` (linha 18) por `const GOOGLE_API_KEY = Deno.env.get("GOOGLE_API_KEY")!;`.
- Pré-requisito: você adicionar `GOOGLE_API_KEY` nas secrets do projeto (vou disparar o tool de adicionar secret depois que o plano for aprovado, ou você já pode adicionar via UI).

### 2. Função `callGateway` (linhas ~1420-1449)
- URL: `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`
- Header: `Authorization: Bearer ${GOOGLE_API_KEY}`
- Modelo: trocar `"google/gemini-2.5-flash-lite"` por `"gemini-2.5-flash"` (nome puro, sem prefixo `google/`, que é convenção do gateway).
- Renomear a função para `callGemini` e atualizar log/mensagens (`AI gateway error` → `Gemini API error`) para clareza, mantendo a mesma assinatura e semântica de retry.

### 3. Tratamento de erros (linhas ~1454-1484)
- Mantém os mapeamentos de status (429 → "muitas perguntas", 5xx → "instável"). Remove o caso `402` (créditos esgotados é específico do Lovable Gateway; a Google retorna 429/quota). Substituir por uma mensagem de quota genérica caso volte 429 com corpo indicando quota.

### 4. Comentários de cabeçalho
- Atualizar o comentário do topo (linhas 1-5): `chama Lovable AI Gateway` → `chama API oficial do Google Gemini (endpoint OpenAI-compatível)`.

## O que NÃO muda
- System prompt em 3 camadas
- Validação JWT, Zod, CORS
- Todas as tools (`create_reminder`, `list_reminders`, `delete_reminder`, `check_reminder_conflict`, `list_cancelled_reminders`)
- `executeTool`, opResults, guards anti-alucinação
- Fetch de dados (papers, equipments, consumables, readings, printing_price_items, etc.)
- Cálculo de impressões por toner
- Estrutura `messages`/`tool_calls`/`role:"tool"` — Gemini OpenAI-compat aceita tudo isso

## Pré-requisito (você)
Adicionar a secret `GOOGLE_API_KEY` nas secrets do projeto. Posso disparar o fluxo `add_secret` após você aprovar o plano, ou você pode colar pela UI antes — qualquer um funciona.

## Risco / observação
- O endpoint OpenAI-compat do Gemini é estável e suporta tool calling, mas em casos raros pode haver pequenas diferenças no `arguments` JSON de `tool_calls`. O código já tem `try/catch` em `JSON.parse(tc.function.arguments)` (linhas 1503-1508), então um payload malformado não derruba a função.
- Se quiser testar antes de derrubar o caminho atual, posso manter `LOVABLE_API_KEY` como fallback opcional via flag — me diga se prefere assim. Por padrão farei substituição limpa.