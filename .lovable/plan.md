# Onda 2 — Listagem e ClientViewer nativos em V3

Com a Onda 1 (edição) entregue, esta onda reconstrói os dois últimos pontos onde ainda dependemos do V2: a tela de **listagem de orçamentos** e o **visualizador público para o cliente**. Depois desta onda, o V2 pode ser deletado sem perder funcionalidade essencial.

Funções avançadas (Opções A/B/C, OP, gerar Pedido, clonar, nova versão, templates, checklist, assistant, engagement avançado, anexos, tags) ficam para a Onda 3.

## Escopo

### 1. Listagem `OrcamentosV3.tsx`
Nova página `src/pages/orcamentos-v3/OrcamentosV3.tsx`, reescrita do zero com o visual e arquitetura V3, preservando todos os recursos atuais do V2:

- **Modos de visualização:** tabela (default) e kanban por status.
- **Filtros:** texto, status, vendedor, cliente, intervalo de datas, tags.
- **Ações em linha:** abrir, editar (vai para `/orcamentos-v3/:id/editar`), duplicar e arquivar.
- **Seleção múltipla + BulkActionBar:** mudar status, arquivar, excluir em lote.
- **Realtime:** indicador de quem está editando o mesmo orçamento (canal Supabase Realtime).
- **Badges:** status do orçamento e indicador de engajamento (visualizações do cliente).
- **Paginação/infinite scroll** mantida igual ao V2.

### 2. ClientViewer público `ClientViewerV3.tsx`
Nova página `src/pages/orcamentos-v3/ClientViewerV3.tsx`, acessível por `/view-quote/:id` e `/p/:quoteNumber`:

- Header com logo, número e validade.
- Lista única de itens (sem opções A/B/C nesta onda — fica para Onda 3).
- Bloco de totais, desconto, frete, condição de pagamento.
- Barra fixa de aprovação ("Aceitar orçamento") com diálogo de confirmação.
- Compartilhamento por WhatsApp.
- Registro de visualização (engagement) idêntico ao V2.

### 3. Componentes reaproveitados em V3
Mover para `src/components/orcamentos-v3/listing/` e `src/components/orcamentos-v3/viewer/`, reescritos no padrão V3 mas mantendo a lógica testada do V2:

- `QuoteStatusBadge`, `EngagementBadge`, `EngagementPopover`
- `BulkActionBar`, `RealtimeRadar`
- `ViewerHeader`, `StickyApprovalBar`, `ApprovalConfirmDialog`, `WhatsAppShareDialog`
- `OptionCard` ainda não — depende de Opções A/B/C (Onda 3)

### 4. Rotas (`src/App.tsx`)
- `/orcamentos` → `OrcamentosV3` (remove o redirect para v2).
- `/orcamentos/novo` → `/orcamentos-v3/novo` (mantém).
- `/orcamentos/:id` → `/orcamentos-v3/:id/editar`.
- `/view-quote/:id` e `/p/:quoteNumber` → `ClientViewerV3`.
- Rotas antigas `/orcamentos-v2/*` viram redirects 301 para as novas, para não quebrar links externos durante a transição.

### 5. Navegação interna
Atualizar para apontar para `/orcamentos`:
- `src/components/Sidebar.tsx`
- `src/components/CommandPalette.tsx`
- `src/pages/Dashboard.tsx`

## Fora desta onda (Onda 3)
- Opções A/B/C (`QuoteOptionsBuilder` + escolha no viewer)
- `CreateVersionButton`, `CloneQuoteButton`
- `GenerateOPButton` (PDF da OP) e `GenerateOrderButton` (gerar Pedido)
- `UseTemplateDialog`, `LoadFromGroupDialog`
- `QuoteAssistant`, `QuoteChecklist`
- UI de anexos e de tags
- Deleção física dos arquivos V2 (só depois que tudo migrar)

## Arquivos tocados

**Novos**
- `src/pages/orcamentos-v3/OrcamentosV3.tsx`
- `src/pages/orcamentos-v3/ClientViewerV3.tsx`
- `src/components/orcamentos-v3/listing/` (QuoteStatusBadge, BulkActionBar, RealtimeRadar, EngagementBadge, EngagementPopover, KanbanBoard, QuotesTable)
- `src/components/orcamentos-v3/viewer/` (ViewerHeader, StickyApprovalBar, ApprovalConfirmDialog, WhatsAppShareDialog)

**Editados**
- `src/App.tsx` (rotas)
- `src/components/Sidebar.tsx`, `src/components/CommandPalette.tsx`, `src/pages/Dashboard.tsx` (links)

Sem migrations.
