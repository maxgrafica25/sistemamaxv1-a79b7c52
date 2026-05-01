
# Plano — Sprint 1: Pedidos de Venda + Contas a Receber

Migração inicial CRM → ERP. Inclui o "momento uau": aprovar um pedido gera automaticamente a(s) parcela(s) no financeiro. Fases 3 (Pagar) e 4 (Fluxo de Caixa) ficam para a próxima sprint.

## O que entra nesta sprint

### 1) Pedidos de Venda
- Página `/pedidos` com **dois modos de visualização** alternáveis no topo:
  - **Lista** (padrão): tabela densa estilo Tiny com filtros (status, cliente, período, busca) e ações inline por linha.
  - **Kanban**: colunas `Aberto` → `Aprovado` → `Em Produção` → `Entregue`, com cards arrastáveis (`@dnd-kit`). `Cancelado` aparece como filtro lateral, não como coluna (evita poluição).
- Status do pedido: `aberto` · `aprovado` · `em_producao` · `entregue` · `cancelado`.
- Numeração automática `PED-2026-0001` (sequence Postgres reiniciando por ano via função).
- Tela de detalhe/edição em dialog grande (não troca de rota — padrão Tiny).
- Campos: cliente, itens (descrição/qtd/preço unit/total), valor total, **condição de pagamento** (à vista, 30, 30/60, 30/60/90, parcelado N×), forma prevista (Pix/boleto/cartão/dinheiro), data de entrega, observações internas, observações para produção.
- **Gerar Pedido a partir do Orçamento V2**: botão no `EditQuoteV2` que copia cliente + opções aprovadas + valor. Mantém `quote_id` para rastreio.
- **PDF Ordem de Produção**: botão "Imprimir OP" — versão técnica sem preços, para o chão de fábrica. Substitui o `GenerateOPButton` atual (que é mock).
- **Timeline** no detalhe: "Orçamento criado X → Pedido aberto Y → Aprovado Z → Faturado W → Pago".

### 2) Contas a Receber
- Página `/financeiro/receber` com **mini-dashboard** no topo:
  - "A receber hoje", "A receber esta semana", "Vencidos", "Recebido no mês".
- Tabela com **semáforo**: 🟢 pago · 🟡 a vencer · 🔴 atrasado · ⚪ cancelado.
- Filtros: status, cliente, categoria, período, forma de recebimento.
- **Gatilho automático**: ao mudar pedido para `aprovado` → dialog "Gerar conta a receber? (3 parcelas de R$ X em 30/60/90 dias)" com possibilidade de ajustar antes de confirmar.
- **Baixa inline** (ação rápida na linha): data de pagamento, valor recebido (permite parcial/desconto/juros), forma efetiva, observação. Status da conta-pai recalculado automaticamente.
- Lançamento manual também permitido (sem pedido vinculado — ex.: reembolso, venda balcão).

### 3) Sidebar reorganizada (parcial, agora)
Já cria a estrutura completa, mesmo que os itens das próximas sprints (Pagar, Fluxo de Caixa) ainda não existam:

```text
PRINCIPAL
  • Dashboard
  • Pedidos                  ← NOVO
  • Orçamentos V2 [Beta]
  • Orçamentos (legado)      ← renomeado, ícone diferente
  • Chat Interno

CADASTROS
  • Clientes/Fornecedores
  • Matérias-Primas
  • Grupos de Materiais
  • Comunicação Visual
  • Catálogo Produtos
  • Equipamentos

FINANCEIRO                   ← visível só para Juliano/Marcelle/admin
  • Contas a Receber         ← NOVO
  • Despesas Fixas

PRECIFICAÇÃO & PRODUÇÃO
  • Preço Impressão
  • Processos de Produção

ANÁLISE
  • Monitoramento de Preços

ADMINISTRAÇÃO
  • Usuários (admin)
  • Configurações
  • Auditoria (admin)
```

## Permissões (regra Juliano/Marcelle)

| Ação | Colaborador comum | Juliano / Marcelle / Admin |
|---|---|---|
| Ver Pedidos | ✅ | ✅ |
| Criar/editar Pedido | ✅ | ✅ |
| Mover Kanban entre `aberto` ↔ `em_producao` ↔ `entregue` | ✅ | ✅ |
| Botão **Aprovar/Faturar** (gera financeiro) | ❌ (botão escondido) | ✅ |
| Cancelar pedido | ❌ | ✅ |
| Ver grupo Financeiro na sidebar | ❌ | ✅ |
| Acessar `/financeiro/*` | ❌ (redirect) | ✅ |
| Dar baixa em conta | ❌ | ✅ |

Identificação de Juliano/Marcelle: por enquanto via `display_name` na tabela `profiles` (mesma regra que já existe para o chat Financeiro). Quando o sistema de roles expandir, troca para uma role `financeiro`.

## Detalhes técnicos

### Banco
- `sales_orders`: id, order_number (unique), client_id, quote_id (nullable), status, total_value, payment_terms, payment_method, delivery_date, internal_notes, production_notes, created_by, approved_by, approved_at, timestamps.
- `sales_order_items`: id, order_id, description, quantity, unit_price, line_total, sort_order.
- `sales_order_status_history`: id, order_id, from_status, to_status, changed_by, changed_at, note.
- `accounts_receivable`: id, order_id (nullable), client_id, description, total_value, category, status (`aberto`/`parcial`/`pago`/`cancelado`), created_by, created_at.
- `accounts_receivable_installments`: id, account_id, installment_number, due_date, amount, paid_at, paid_amount, payment_method, notes.
- Sequence `sales_order_seq_2026` + função `next_order_number()` que gera `PED-AAAA-0001` e reinicia a cada ano.
- Função helper `is_financeiro_user(uid)` (security definer) — checa se é admin OU display_name in ('Juliano','Marcelle'). Usada nas RLS e na sidebar.

### RLS
- `sales_orders`: SELECT/INSERT/UPDATE para todos autenticados; DELETE só admin. Trigger bloqueia mudança de status para `aprovado` se não for `is_financeiro_user`.
- `accounts_receivable*`: SELECT/INSERT/UPDATE/DELETE só `is_financeiro_user`.
- Triggers:
  - `on_sales_order_status_change` → grava history + audit_logs.
  - `on_sales_order_approved` → não cria conta automática; só sinaliza para o frontend abrir o dialog de confirmação (controle do usuário).
  - `on_installment_paid` → recalcula status da conta-pai.

### Kanban
- `@dnd-kit/core` + `@dnd-kit/sortable` (já é o padrão da stack).
- Drag entre colunas dispara update de status com optimistic UI + rollback em erro.
- Tentativa de mover para `aprovado` por colaborador comum → toast "Apenas financeiro pode aprovar".

### Realtime
- `sales_orders` e `accounts_receivable` no `supabase_realtime` para Kanban e dashboard atualizarem ao vivo (vários usuários simultâneos).

## Fora do escopo desta sprint
- Contas a Pagar (próxima sprint)
- Fluxo de Caixa Projetado (próxima sprint, depende de ter Pagar)
- Emissão de NF-e, gateway de pagamento, conciliação bancária, baixa de estoque

---

Tudo certo para eu começar a implementar?
