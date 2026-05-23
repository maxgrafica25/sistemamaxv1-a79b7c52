
# Auditoria profunda de resquícios V2

Fiz uma varredura criteriosa: rotas, imports, FKs do banco, comentários de código, tabelas legacy e chaves de storage. Restam alguns itens. Resumo abaixo separando o que **vale remover/renomear** e o que **NÃO deve ser mexido** (com justificativa).

---

## A. Componentes órfãos em `src/components/orcamentos-v3/listing/` — REMOVER

Verificado que nenhum arquivo do projeto importa estes (apenas auto-referências entre eles):

- `CVItemCard.tsx` — o tipo `CVItemState` já foi movido para `types.ts`; o componente em si era o card de edição CV do V2. No V3 a edição de CV é feita por `forms/CVForm.tsx`.
- `EngagementBadge.tsx` — substituído por `EngagementPopover` na listagem.
- `StickyFinancialSidebar.tsx` — substituído por `cart/StickyFinancialSidebarV3` (sidebar do V3).
- `PriceBreakdown.tsx` — só era usado por `StickyFinancialSidebar` (cadeia órfã).
- `QuoteOptionsBuilder.tsx` — substituído por `cart/QuoteOptionsBuilderV3.tsx`.

## B. Utilitários órfãos em `src/lib/quotes/` — REMOVER

Nenhum import em todo o `src/`:

- `finishing-suggestions.ts` (existe a versão CV em `cv-finishing-suggestions.ts`, ainda em uso)
- `item-title.ts`
- `labor-display.ts`
- `subject-suggestion.ts`

## C. Pasta legada `src/components/orcamentos/` — MOVER e REMOVER

Sobrou apenas um arquivo nessa pasta, que ainda é usado por 5 arquivos do V3:

- Mover `src/components/orcamentos/PrintingItemSearch.tsx` para `src/components/orcamentos-v3/shared/PrintingItemSearch.tsx`.
- Atualizar 5 imports (`useV3Catalog`, `BookletForm`, `PrintForm`, `CustomCoverEditor`, `BusinessCardForm`, `lib/quotes/pricing.ts`).
- Apagar a pasta `src/components/orcamentos/` (ficará vazia).

## D. Renomeações cosméticas dentro de `OrcamentosV3.tsx` — RENOMEAR

- Função `export default function OrcamentosV2()` → `OrcamentosV3()`.
- `CardTitle` "Lista V2" → `Lista de Orçamentos`.

## E. Mensagem de erro desatualizada em `shared/loadQuoteV3.ts` — AJUSTAR

Texto atual: *"Este orçamento não foi criado no V3 e não pode ser editado aqui. Abra-o na versão V2."*

Como o V2 não existe mais como editor (o link `/p/{numero}` abre o viewer somente-leitura), atualizar para:

*"Este orçamento foi criado em uma versão anterior do sistema e está disponível apenas para visualização. Use o link público para abri-lo."*

## F. Canal Realtime `quotes-radar-v2` em `listing/RealtimeRadar.tsx` — RENOMEAR

`.channel("quotes-radar-v2")` → `.channel("quotes-radar")`. Sem efeito colateral: o nome do canal é só um identificador local, não persiste nada.

---

## NÃO MEXER (com justificativa)

1. **Redirects `/orcamentos-v2`, `/orcamentos-v2/*`, `/view-quote-v2/:id` em `App.tsx`** — protegem links antigos compartilhados via WhatsApp/e-mail. Custo zero, benefício real. Mantém.

2. **Tabelas `legacy_cv_materials`, `legacy_cv_finishes`, `legacy_cv_printers` e `cv_quote_items`** — apesar do prefixo "legacy", continuam sendo escritas pelo `saveQuoteV3.ts` (comentário "paridade com V2") e referenciadas por FK. Existem 1 registro em cada. Remover quebraria criação de orçamentos CV no V3. **Decisão técnica de banco fica fora dessa limpeza.**

3. **Tag `'v3'` em `quotes.tags`** — usada como discriminador na listagem (`isV3 = tags.includes("v3")`) para decidir entre abrir editor (V3) ou viewer público (legacy). É contrato vivo.

4. **Chaves localStorage `qv2_visitor`, `qv2_view_*`, `qv2_scroll_*` em `lib/quotes/tracking.ts` e `useScrollDepthTracking.ts`** — renomear apagaria histórico de visitas/scroll dos clientes (eles perderiam estado). Comentário "v2" no nome é só nostálgico, sem efeito funcional. **Manter.**

5. **Comentários históricos "V2" espalhados** (`useV3Catalog`, `useV3CVCatalog`, `useV3HourlyRate`, `bookletKit`, `engine.ts`, `saveQuoteV3`, `useQuoteDraftV3`, `LaborForm`, `SupplyForm`, `LabelEmbeddedForm`, `approval-terms`) — apenas explicam de onde a lógica veio. Têm valor documental, não geram conflito. **Manter.**

6. **Adapters `cart/QuoteAssistantPanelV3` e `cart/QuoteChecklistPanelV3`** — ainda dependem de `listing/QuoteAssistant` e `listing/QuoteChecklist` (componentes vivos), e estes por sua vez foram redirecionados para importar tipos de `types.ts`. Tudo coerente. **Manter.**

---

## Resumo do que será feito (se aprovado)

1. Apagar 5 componentes órfãos em `listing/` (item A).
2. Apagar 4 utilitários órfãos em `lib/quotes/` (item B).
3. Mover `PrintingItemSearch` para `orcamentos-v3/shared/` e remover a pasta `components/orcamentos/` (item C).
4. Renomear função/título em `OrcamentosV3.tsx` (item D).
5. Atualizar mensagem em `loadQuoteV3.ts` (item E).
6. Renomear canal Realtime para `quotes-radar` (item F).

Não toco em rotas legacy, tabelas legacy_cv_*, tag `v3`, localStorage `qv2_*` nem comentários históricos.
