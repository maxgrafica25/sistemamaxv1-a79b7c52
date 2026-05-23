# Status pós-Onda 3

## Concluído nesta onda
- Passo 1: utilitários compartilhados (SupplySearch, ClientCombobox, ProcessPicker, CVItemCard, StepTypeBadge) agora vivem em `src/components/orcamentos-v3/listing/`. Todos os imports foram rewireados.
- Passo 4: pastas `src/pages/orcamentos-v2/` e `src/components/orcamentos-v2/` deletadas. Rotas `/orcamentos-v2/*` redirecionam para `/orcamentos`. Listagem V3 abre quotes V2 antigos no ClientViewer público (read-only).
- `src/lib/quotes-v2/*` permanece (biblioteca de regras de negócio).

## Pendente — Onda 4 (porting de blocos do antigo form V2 para o V3 form)
Os componentes-fonte estão preservados em `src/components/orcamentos-v3/listing/` (foram copiados na Onda 2):

1. **QuoteChecklist** → integrar no painel direito do `NewQuoteFormV3`.
   Bloqueio: precisa de `quoteId` (só existe após primeiro save) + adapter `V3CVItem` → `CVItemState`.

2. **QuoteAssistant** → painel de sugestões IA no lado direito.
   Bloqueio: adapter `V3CVItem` → `CVItemState`, e adicionar `clientTags` ao `V3QuoteState`.

3. **QuoteOptionsBuilder (Opções A/B/C)** → bloco abaixo do carrinho.
   Bloqueio mais sério: V2 usa `PricingSnapshot` (item único). V3 tem carrinho com N itens.
   Precisa de função `buildSnapshotFromV3Cart(state)` em `shared/pricing.ts` que agrega o carrinho num snapshot equivalente, e `saveQuoteV3` precisa persistir `quotes.options` e `quote_materials.option_id`.

Cada bloco é ~200-400 linhas de trabalho real. Vale uma onda própria por bloco.

## Fora de escopo
- UI de tags por orçamento dentro do V3 form.
- UI de anexos por orçamento.
- Repolimento visual do `OrcamentosV3` e `ClientViewerV3` no padrão minimalista V3.
