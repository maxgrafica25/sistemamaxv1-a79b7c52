

# Júlia: respostas mais objetivas, amigáveis e legíveis

## Problema

1. **Asteriscos crus**: o prompt manda usar `**negrito**` (ex.: "**Treino às 11h**"), mas o bubble da Júlia renderiza como texto puro com `whitespace-pre-wrap`. O usuário vê `**Treino às 11h**` literal, polui a leitura.
2. **Tom seco**: o prompt diz "direta, sem rodeios" — vira robótico. Falta um toque amigável (1 emoji ocasional, frases curtas com personalidade).
3. **Blocos densos**: confirmação + próximo passo + chips vêm coladas. Falta hierarquia visual (título da ação, detalhe abaixo, separação).

## Mudanças

### 1. Renderizar markdown no bubble da Júlia
`src/components/assistente/AssistenteMensagem.tsx`:
- Adicionar `react-markdown` (já é a prática recomendada para chats de IA).
- Renderizar **só as mensagens do assistente** com `<ReactMarkdown>` (mensagens do usuário continuam texto puro).
- Estilizar com classes Tailwind para: `**negrito**`, listas `-`, quebras de linha, e `code` inline. Sem `prose` pesado — manter compacto e coerente com o bubble atual.

### 2. Atualizar tom e formato no prompt (`camada1`)
`supabase/functions/assistente-virtual/index.ts`:
- Trocar "direta, sem rodeios" por: **"objetiva, amigável e calorosa, sem ser longa. Use no máximo 1 emoji por resposta, só quando agregar (✅ confirmação, ⏰ horário, 📅 data, ⚠️ conflito). Nunca emoji em respostas técnicas de preço."**
- Padrão de confirmação de lembrete criado:
  ```
  ✅ **Pronto!** Te aviso às **10h45** sobre o **treino das 11h**.
  ```
  (1 linha, em vez do "Pronto! Vou te avisar às 10h sobre o treino das 11h." atual)
- Padrão para fila de pendentes (Linha A/C):
  ```
  ✅ Treino das 11h confirmado.

  Falta combinar o **instagram às 16h**. Quando quer ser avisado?
  ```
- Padrão para conflito:
  ```
  ⚠️ Já tem **<título>** marcado pra **<hora>**.

  Quer (a) substituir, (b) manter os dois ou (c) cancelar?
  ```
- Padrão para listagem de lembretes (`list_reminders`): bullet list em markdown com horário em negrito.
- Regra geral nova: **"Respostas curtas. Máx 3 linhas para confirmações, 5 para listagens. Use `**negrito**` só em horários, títulos e ações principais. Use `-` para listas com 2+ itens."**

### 3. Preservar exceções
- Respostas de **preço** continuam técnicas, sem emoji, formato atual.
- Respostas de erro/"não encontrei" continuam diretas.
- O marcador `[JULIA_CHIPS:lead_time]` continua igual (o frontend já remove antes de exibir).

## Arquivos alterados

- `src/components/assistente/AssistenteMensagem.tsx` — adicionar render markdown nas mensagens do assistente
- `package.json` — dependência `react-markdown`
- `supabase/functions/assistente-virtual/index.ts` — ajustar tom + formatos na string `camada1`

## Resultado esperado

**Antes:**
```
Pronto! Vou te avisar às 10h sobre o treino das 11h.

Falta combinar o aviso de **instagram às 16h**. Quando quer ser avisado?
```

**Depois:**
```
✅ Treino das 11h confirmado.

Falta combinar o instagram às 16h. Quando quer ser avisado?
```
(com "instagram às 16h" em negrito real, sem asteriscos visíveis)

## Fora do escopo

- Sem mudanças nas ferramentas, schema, fluxo de chips, ou lógica de dedupe/conflito.
- Sem mudar respostas de preço.

