

# Júlia: chips de antecedência + auto-scroll

## O que muda

Quando você registrar um compromisso com horário (ex.: *"tenho dentista amanhã às 14h"*) sem dizer a antecedência, a Júlia vai:

1. Responder em texto: *"Quando quer ser avisado?"*
2. Mostrar **4 botões clicáveis** logo abaixo da mensagem:
   - `Na hora`
   - `1 hora antes`
   - `3 horas antes`
   - `Personalizar`
3. Ao clicar num dos 3 primeiros, a antecedência vai automaticamente como próxima mensagem do usuário e a Júlia cria o lembrete.
4. Ao clicar em `Personalizar`, abre um campo inline pedindo: *"Ex.: 30min, 2h, 1 dia"* — você digita e envia.

Tarefas avulsas sem horário marcado (*"me lembra de tomar água às 16h"*) continuam sendo criadas direto, sem perguntar antecedência.

## Como funciona por trás (técnico)

**Edge function `assistente-virtual/index.ts`** — Camada 1 do prompt:
- Nova regra: ao detectar compromisso com horário sem antecedência informada, responder com texto curto + um marcador estruturado no fim da resposta:
  ```
  [JULIA_CHIPS:lead_time]
  ```
- Esse marcador é invisível na UI mas o frontend detecta e renderiza os chips.
- O contexto do compromisso (título + horário) fica no histórico, então quando o usuário responder "1 hora antes", a Júlia aplica a regra existente (`title="Dentista às 14h"`, `description="Aviso 1h antes do compromisso das 14h."`, `remind_at` calculado).

**Componente `AssistenteMensagem.tsx`**:
- Detectar `[JULIA_CHIPS:lead_time]` no `content` do assistente.
- Remover o marcador do texto exibido.
- Renderizar 4 botões abaixo da mensagem; ao clicar nos 3 primeiros, dispara `onChipClick("na hora" | "1 hora antes" | "3 horas antes")` que entra como mensagem do usuário e chama o envio normal.
- Ao clicar `Personalizar`, expande um `Input` + botão `Enviar` inline.
- Os chips desaparecem assim que o usuário responde (uma vez usados).

**Componente `AssistenteButton.tsx`**:
- Passar callback `onChipClick(text)` para `AssistenteMensagem` que faz `setInput(text)` + chama `enviar()`.
- **Auto-scroll**: trocar `scrollRef.current.scrollTop = scrollHeight` por sentinela `<div ref={bottomRef} />` no fim da lista + `bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })` no `useEffect`. Isso resolve o bug do Radix `ScrollArea` (o elemento rolável real é o Viewport interno, não o nosso div).

## Arquivos tocados

1. `supabase/functions/assistente-virtual/index.ts` — adicionar regra dos chips no prompt `camada1`.
2. `src/components/assistente/AssistenteMensagem.tsx` — detectar marcador e renderizar chips/input personalizado.
3. `src/components/assistente/AssistenteButton.tsx` — callback de chip + fix do auto-scroll com sentinela.

Sem mudança de schema, RLS, `reminders-api`, cron ou outras telas.

## Validação

1. *"Tenho dentista amanhã às 14h"* → Júlia pergunta + 4 chips aparecem. Clicar `1 hora antes` → cria lembrete `Dentista às 14h` para 13h.
2. Clicar `Personalizar` → input aparece, digitar `45min`, enviar → cria lembrete para 13h15.
3. *"Me lembra de tomar água às 16h"* → cria direto, sem chips.
4. Conversa longa → rola sozinha até o fim quando chega resposta nova.

## Fora deste escopo

- Persistir chips entre reaberturas do painel (somem ao fechar — aceitável).
- Google Calendar (Fase 2.5).

