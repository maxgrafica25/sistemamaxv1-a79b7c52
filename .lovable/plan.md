

# Júlia: corrigir resposta "Quando" sem chips

## O problema

Você disse "amanhã às 16h tenho dentista". A Júlia deveria perguntar "Quando quer ser avisado?" e mostrar os botões **Na hora / 1h antes / 3h antes / Personalizar**. Em vez disso respondeu só **"Quando"** seco, sem chips.

Causa: a regra no prompt diz pra ela responder *"Quando quer ser avisado?"* + marcador técnico `[JULIA_CHIPS:lead_time]`. O modelo (Gemini 3 Flash) abreviou a frase pra "Quando" e esqueceu o marcador — sem o marcador o frontend não sabe que tem que mostrar os chips.

## Correção

Endurecer a instrução em `supabase/functions/assistente-virtual/index.ts` (camada1 do system prompt) pra deixar à prova de improviso:

1. **Frase obrigatória, palavra por palavra**: trocar "Responda apenas: 'Quando quer ser avisado?'" por instrução mais firme — "Sua resposta DEVE ter exatamente 2 linhas: linha 1 = `Quando quer ser avisado?` (literal, sem variar), linha 2 = `[JULIA_CHIPS:lead_time]`. Nada antes, nada depois, nada no meio."

2. **Exemplo positivo e negativo** dentro do prompt mostrando: ✅ resposta correta de 2 linhas vs ❌ "Quando" / "Quando você quer?" / "Me diga quando" sozinhos.

3. **Reforço no fim do prompt**: adicionar uma regra final tipo "Se for emitir um marcador `[JULIA_CHIPS:...]`, ele é OBRIGATÓRIO em linha separada — sua resposta sem ele quebra a interface."

4. **Fallback no frontend** (`AssistenteMensagem.tsx`): se a resposta for muito curta (≤15 caracteres) e contiver "quando" + sinal de pergunta ou ambiguidade, e a última mensagem do usuário mencionou compromisso com horário (dentista, médico, reunião, etc.), mostrar os chips assim mesmo. Rede de segurança caso o modelo erre de novo.

## Validação

Mande de novo "amanhã às 16h tenho dentista" → deve aparecer "Quando quer ser avisado?" + 4 botões logo abaixo.

## Fora deste escopo

- Trocar de modelo (Gemini 3 Flash continua — só ajustamos o prompt).
- Mudar visual dos chips.

