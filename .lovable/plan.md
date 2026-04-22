

# Júlia agente — Fase 1 confirmada (Lembretes via linguagem natural)

A Fase 1 já foi entregue na iteração anterior: a Edge Function `reminders-api` está criada com endpoints `POST/GET/DELETE`, validação Zod, JWT em código e RLS reaproveitada; a `assistente-virtual` declara as 3 tools (`create_reminder`, `list_reminders`, `delete_reminder`), injeta `nowSP` no prompt e roda loop de execução com limite de 3 iterações; cron `check-reminders` e `NotificationBell` permanecem intactos.

Este plano apenas **confirma o roadmap mestre** (Fases 2–4) que você acabou de aprovar e propõe uma checagem de saúde da Fase 1 antes de seguir.

## Verificação da Fase 1 (sem mudanças de código)

1. *"Me lembre do dentista amanhã às 14h"* → confirma criação, repete detalhes em pt-BR.
2. *"Agende reunião sexta às 10h, me avise 1h antes"* → `remind_at` = sexta 09:00.
3. *"Me lembre de ligar pro Juliano"* → pede data/hora.
4. *"Quais meus lembretes?"* → lista pendentes.
5. *"Cancele o lembrete do dentista"* → exclui (pede desambiguação se múltiplos).
6. No horário, `NotificationBell` toca via realtime.

Se algum item falhar, abrir nova issue dirigida ao ponto específico (prompt da Camada 1, schema da tool, ou validação Zod).

## Roadmap registrado para próximas fases

### Fase 2 — Sugestões proativas (próxima iteração)
- Novo cron (ou expansão do `check-reminders`) varre dados operacionais: nível estimado de toner (já temos `lastTonerChangeByConsumable` + `realYield`), estoque de papel, contadores.
- Gatilhos: toner restante < 10%, papel sem reposição há X dias.
- Cria `notifications` com `type='proactive'` e payload contextual.
- Frontend: ao clicar nessa notificação, abre o assistente com mensagem pré-preenchida da Júlia já contendo o contexto (via querystring/state passado ao `AssistenteButton`).

### Fase 3 — Automação de tarefas (iteração seguinte)
- Tool registry expandido: `update_quote_status`, `create_purchase_request`, `generate_report`.
- Cada tool aponta para uma Edge Function dedicada com validação Zod e RLS própria.
- Toda ação de escrita pede confirmação explícita do usuário antes de executar (tool retorna `requires_confirmation: true` no primeiro turno).

### Fase 4 — Multi-turn complexo (evolução contínua)
- Nova tabela `conversation_state(session_id, user_id, flow, slots jsonb, updated_at)`.
- Helper na Edge Function para `loadState`/`saveState` por `session_id` (gerado no frontend e persistido enquanto o sheet do `AssistenteButton` está aberto).
- Modelagem de fluxos por slots (ex.: orçamento → papel, tamanho, F/V, qtd, acabamento).

## Não muda agora
- Tabelas existentes, RLS, cron, `NotificationBell`, `QuoteReminderButton`.
- Lógica de preços (`calcPV`, multiplicadores, BDI).
- Camada 2 (base de conhecimento) e seções de equipamentos/preços da Camada 3.

## Próximo passo recomendado

Antes de abrir Fase 2, validar manualmente os 6 cenários acima no preview. Quando algum cenário falhar, me chame com o sintoma específico — corrijo de forma cirúrgica no prompt ou no schema da tool sem expandir escopo.

