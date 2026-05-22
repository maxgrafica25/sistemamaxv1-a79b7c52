## Finalização do sistema "Recorrentes do cliente"

Três últimos passos para fechar a funcionalidade:

### 1. Card no Dashboard
Importar e renderizar `RecorrentesVencendoCard` em `src/pages/Dashboard.tsx`, posicionado junto aos outros cards de alerta/lembrete (acima dos módulos principais). O card já se auto-oculta quando não há recorrentes vencendo, então não polui quando vazio.

### 2. Cron job de lembretes
Agendar `enqueue_recurring_reminders()` para rodar 1x por dia (08:00 BRT = 11:00 UTC) via `pg_cron` + `pg_net`. Usa `supabase--insert` (não migration) porque contém a URL/anon key do projeto.

```text
cron: '0 11 * * *'  → SELECT public.enqueue_recurring_reminders();
```

Garante extensões `pg_cron` e `pg_net` habilitadas antes.

### 3. Auto-abrir PostPrintDialog em /pedidos
Em `src/pages/Pedidos.tsx` (ou no componente do kanban que muda status), detectar transição de status para `entregue` em pedidos que tenham `recurring_id` preenchido. Quando ocorrer:
- Disparar abertura do `PostPrintDialog` já existente
- Pré-preencher `recurring_id` + `sales_order_id`
- Após salvar (chama `mark_recurring_printed`), o trigger já recalcula `proxima_prevista_em` e dispensa a notificação

Fluxo: arrastar card para "Entregue" → dialog abre → operador escolhe equipamento + carga de cor + obs → salva → histórico criado, próxima data recalculada, lembrete some.

### Validação final
- Dashboard mostra card só quando há recorrentes vencendo
- Cron roda diariamente e cria notificações na inbox
- Mover pedido para "entregue" abre dialog automaticamente
- Após salvar, recorrente aparece com nova `proxima_prevista_em` na ficha do cliente
