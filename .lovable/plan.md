# Auditoria V2 → V3: o que ainda falta

V3 hoje tem **apenas** a rota `/orcamentos-v3/novo` (criar orçamento novo). V2 tem listagem, edição, visualização pública e várias ações pós-venda que **ainda não existem em V3**.

## Faltando completamente em V3

### Páginas/rotas
| V2 | Status V3 |
|---|---|
| `OrcamentosV2.tsx` — listagem com filtros, busca, kanban, status | Não existe |
| `EditQuoteV2.tsx` — editar orçamento existente | Não existe |
| `ClientViewer.tsx` — visualização pública do orçamento (link/WhatsApp) | Não existe |

Sem isso, **um orçamento criado em V3 só pode ser visto/editado pelo V2** (ou nem aparece, dependendo dos filtros).

### Ações sobre orçamento (componentes V2 não portados)
- **`CloneQuoteButton`** — duplicar orçamento inteiro.
- **`CreateVersionButton`** — criar nova versão (usa `create_quote_version` no DB; trava o pai).
- **`GenerateOPButton`** — gerar PDF de Ordem de Produção.
- **`GenerateOrderButton`** — converter orçamento em Pedido (ERP).
- **`UseTemplateDialog`** — partir de um template salvo.
- **`LoadFromGroupDialog`** — carregar itens de um grupo de produção.
- **`BulkActionBar`** — ações em lote na listagem (excluir, mudar status).
- **`QuoteStatusBadge`** + fluxo aprovado/parcial/recusado (existe no DB via `approve_quote_items`, mas sem UI em V3).

### Engajamento / rastreio
- **`EngagementBadge`** + **`EngagementPopover`** — visualizações, scroll, opções selecionadas pelo cliente (`quote_engagement_events`).
- **`RealtimeRadar`** — quem está olhando o orçamento agora (Realtime).

### Assistente e QA
- **`QuoteAssistant`** — sugestões via IA durante o preenchimento.
- **`QuoteChecklist`** — verificações antes de enviar.

### Cliente
- **`ClientDetailsPanel`** — painel lateral com dados completos do cliente.
- **`ClientLastSalesPanel`** — últimas vendas do cliente.

### Estrutura de opções A/B/C
- **`QuoteOptionsBuilder`** — agrupar itens em "Opção A / Opção B" para o cliente escolher (campo `options` em `quotes`). V3 só monta lista única.

## Funciona em V3, mas parcial / divergente

- **Frete (`FreightSelector` V2)**: V3 grava `freight_value`/`freight_type_id`? Conferir no `saveQuoteV3`. Se sim, falta a UI dedicada.
- **Desconto e forma de pagamento (`DiscountPaymentBlock`)**: V3 tem? Hoje o `FinancialPanel` é mais enxuto — precisa confirmar paridade.
- **`PriceBreakdown` / `StickyFinancialSidebar`**: V3 usa `FinancialPanel`, mas sem detalhamento por item ao nível do V2.
- **Anexos (`quote-attachments` bucket)**: V2 anexa arquivos ao orçamento — não vi UI em V3.
- **Tags e `attention_to`**: existem no DB e em V2; conferir se V3 expõe.
- **Validade, observações internas (`notes`)**: idem.

## O que JÁ está em V3 (paridade ou superior)
- Criação de itens (Impressão, CV, Cartão, Booklet, Etiqueta, Produto, Mão-de-obra, Suprimento, Terceiros).
- Kits, presets, tier groups.
- Duplicar item individual (não o orçamento todo).
- Pergunta de "Arte pronta?" com 4 faixas + terceirizada (não existe em V2).
- Persistência de `art_status` em impressão e CV (acabamos de fechar).

## Próximo passo sugerido (a confirmar)
1. Confirmar quais dessas faltas são **bloqueantes** para você rodar o dia-a-dia em V3.
2. Priorizar em ondas:
   - **Onda 1 (mínimo viável):** Listagem V3 + Edição V3 + visualização pública (ClientViewer) → para parar de depender do V2.
   - **Onda 2 (operação):** Versão, Clonar, gerar PDF OP, gerar Pedido, aprovação parcial.
   - **Onda 3 (engajamento/IA):** Engagement, Radar realtime, Assistant, Checklist.
   - **Onda 4 (refino):** Opções A/B, anexos, painéis de cliente.

Quer que eu detalhe um plano completo de uma das ondas?
