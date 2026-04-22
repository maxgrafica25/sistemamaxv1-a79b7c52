

# Renomear assistente para "Júlia" da Max Gráfica

## Mudanças

**1. `src/components/assistente/AssistenteButton.tsx`**
- Título do Sheet: "Assistente" → "Júlia"
- aria-label do botão: "Abrir Júlia, assistente virtual da Max Gráfica"
- Mensagem de boas-vindas: "Oi, eu sou a Júlia, assistente da Max Gráfica! Pergunte sobre toners, preços, papéis ou qualquer coisa cadastrada no sistema."
- Toasts: "Erro na Júlia"

**2. `supabase/functions/assistente-virtual/index.ts`**
- Camada 1 do system prompt: "Você é a Júlia, assistente virtual da Max Gráfica. Quando se apresentar ou for perguntada seu nome, responda que se chama Júlia e que trabalha na Max Gráfica."

## Fora de escopo

- Renomear pasta `assistente/` ou a Edge Function `assistente-virtual` (só o nome visível ao usuário muda).

## Risco

Nenhum. Apenas texto visível e prompt.

