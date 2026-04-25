# Alertas de Leituras Atrasadas via Chat Interno

Substituir email por **notificações no chat interno** + **inbox**, com escalada de severidade, **link de ação direta** que abre o modal de Leitura Rápida em 1 clique, e gancho preparado para a Júlia (assistente virtual) assumir o envio das mensagens no futuro.

## Parte 1 — Ajuste de UI (rápido)

Em `src/components/equipamentos/PrinterReadingsTab.tsx`, na função `getTypeBadge`:
- Quando o registro for **troca de toner sem cor identificável** (não-CMYK), usar **laranja** (`bg-orange-500`) em vez de ciano, evitando confusão com o badge "Ciano".

## Parte 2 — Sistema de alerta no chat interno

### Estratégia
- **Cron diário** (Seg–Sex, 09:00 BRT / 12:00 UTC) varre `printer_readings` e identifica equipamentos `pb`/`color` com **≥ 2 dias úteis** sem leitura `daily`.
- Equipamentos que **nunca tiveram leitura** são ignorados.
- Para cada gap detectado dispara **2 canais**:
  1. Mensagem no canal `#alertas-equipamentos`.
  2. Notificação individual (sino) para `role='admin'` + destinatários extras.
- **Reenvio diário** com contador crescente até regularizar.

### Escalada de severidade

| Atraso (dias úteis) | Severidade | Tom | Emoji | Inbox |
|---|---|---|---|---|
| 2–4 | **Lembrete** | "Olá! Notei que o equipamento X está sem leitura há N dias. Pode atualizar?" | 🟡 | `info` |
| 5+ | **CRÍTICO** | "🚨 ATENÇÃO: equipamento X sem leitura há N dias úteis. Esquecimento crônico — regularizar HOJE." | 🔴 🚨 😡 | `warning` |

Críticos vêm **primeiro** e em **negrito** na mensagem consolidada.

### Link de Ação Direta (NOVO — "pulo do gato")

Cada item da mensagem terá um link **`👉 [Lançar Leitura Agora]`** que leva direto ao modal de Leitura Rápida do equipamento certo, em 1 clique:

**Formato do link**: `/equipamentos?tab=leituras&quick=<equipment_id>`

**Implementação no app**:
- `src/pages/Equipamentos.tsx` lê `searchParams`:
  - Se `tab=leituras` → seleciona a aba "Leituras".
  - Passa `autoOpenQuickFor={equipmentId}` para `<PrinterReadingsTab>`.
- `PrinterReadingsTab` (linha ~674, onde está `setShowQuickDialog`):
  - `useEffect` que monitora `autoOpenQuickFor`; se preenchido, seta `selectedEquipment` correspondente e abre `setShowQuickDialog(true)` automaticamente.
  - Limpa o `?quick=` da URL após abrir (via `navigate(..., { replace: true })`) pra não reabrir em refresh.
- Na **mensagem do chat**: link em markdown — `[👉 Lançar Leitura Agora](/equipamentos?tab=leituras&quick=<id>)` (o `ChatMessages` já renderiza markdown).
- Na **notificação do sino**: o `notifications` ganha campo de link no campo `source_id`/`source_type` já existente; ao clicar na notificação, faz `navigate(\`/equipamentos?tab=leituras&quick=${source_id}\`)`.

**Por destinatário**, o link é o mesmo (não personalizado). Foco é zero atrito.

Quando há múltiplos atrasos, cada linha da mensagem tem seu próprio link — o operador não precisa procurar nada.

### "Print de demonstração" do primeiro alerta crítico

Para servir de evidência institucional:
- Coluna `is_first_critical` em `reading_alerts_sent` (índice parcial único `WHERE is_first_critical = true`).
- Card destacado em `/equipamentos` (admins) quando esse primeiro crítico existe, com botão **"Ver mensagem no chat"** que abre o `#alertas-equipamentos` na mensagem em destaque.
- Quando o evento ocorrer, **eu (assistente) capturarei via `browser--screenshot`** e entregarei a imagem em `/mnt/documents/primeiro-alerta-critico.png`.

### Banco de dados (migração)

**Tabela `reading_alerts_sent`**:
```
id, equipment_id, gap_start_date, days_overdue,
severity ('reminder'|'critical'),
is_first_critical boolean default false,
alerted_at, channel ('chat'|'inbox'),
resolved_at
```
- Índice único `(equipment_id, gap_start_date, DATE(alerted_at))`.
- Índice único parcial `WHERE is_first_critical = true`.

**Tabela `alert_recipients`**:
```
id, name, user_id (nullable), external_email (nullable, futuro),
notify_chat, notify_inbox, notify_email (futuro),
active, created_at
```

**Seed**: canal `alertas-equipamentos` (público, setor "Produção") + perfil "Júlia (Sistema)".

**Trigger de resolução**: `AFTER INSERT` em `printer_readings` (quando `type='daily'`) → marca `resolved_at = now()` em alertas ativos do equipamento.

### Edge Function `check-overdue-readings`

`supabase/functions/check-overdue-readings/index.ts` (verify_jwt = false, cron):

Modular para a Júlia reaproveitar:

1. **`detectOverdueReadings()`** → `{equipment, lastDate, daysOverdue, lastOperator, severity}`.
2. **`buildChatMessage(gaps)`** → markdown com bloco crítico primeiro, depois lembretes; **cada linha inclui `[👉 Lançar Leitura Agora](/equipamentos?tab=leituras&quick=<id>)`**.
3. **`notifyOverdueReadings(gaps)`** → posta no chat (autor "Júlia (Sistema)") + insere `notifications` por destinatário (`source_type='overdue_reading'`, `source_id=equipment_id` para o link funcionar no sino).
4. **Idempotência**: consulta `reading_alerts_sent` para não repetir no mesmo dia.
5. **Marca `is_first_critical=true`** no primeiro registro crítico do histórico.

### Cron job (via insert tool, contém URL+chave do projeto)
```sql
SELECT cron.schedule(
  'check-overdue-readings-daily',
  '0 12 * * 1-5',
  $$ SELECT net.http_post(
       url:='https://nxkmxslugblhsyohrrvm.supabase.co/functions/v1/check-overdue-readings',
       headers:='{"Content-Type":"application/json","Authorization":"Bearer <anon_key>"}'::jsonb
     ); $$
);
```

### Gancho para a Júlia (futuro)
- `detectOverdueReadings()` e `notifyOverdueReadings()` exportáveis.
- Júlia poderá redigir mensagens em linguagem natural mantendo regra de escalada e **incluindo o link de ação direta** automaticamente.
- Gerenciamento de `alert_recipients` por comando no chat.
- Flag `notify_email` pronta para quando o domínio for configurado.

## Detalhes técnicos

**Cálculo de dias úteis**:
```sql
SELECT COUNT(*) FROM generate_series(last_date+1, current_date, '1 day') d
WHERE EXTRACT(DOW FROM d) NOT IN (0, 6);
```

**Autor da mensagem**: perfil "Júlia (Sistema)" criado via seed; edge function usa `service_role`.

**Notificação clicável (sino)**: o componente `NotificationBell` precisa rotear para `/equipamentos?tab=leituras&quick=<source_id>` quando `source_type='overdue_reading'`. Pequeno ajuste no handler de clique.

## Resumo de entregáveis

1. UI: badge laranja para troca de toner sem cor identificável.
2. Migração: tabelas `reading_alerts_sent` (com `severity` + `is_first_critical`) e `alert_recipients`, perfil "Júlia (Sistema)", canal `alertas-equipamentos`, trigger de resolução.
3. Edge function `check-overdue-readings` modular com escalada de severidade e **link de ação direta** em cada item.
4. Cron job seg–sex 09:00 BRT (via insert tool).
5. `Equipamentos.tsx` + `PrinterReadingsTab.tsx`: suporte a `?tab=leituras&quick=<id>` para abrir o modal de Leitura Rápida automaticamente.
6. `NotificationBell`: roteamento para o link direto quando `source_type='overdue_reading'`.
7. UI mínima em `/configuracoes` para gerenciar destinatários extras.
8. Card destacado em `/equipamentos` celebrando o primeiro alerta crítico; screenshot entregue por mim quando o evento ocorrer.