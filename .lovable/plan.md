
# Limpeza adicional sugerida

Depois da renomeação `quotes-v2 → quotes`, ainda existem alguns pontos no código que valem a pena ajustar para evitar confusão e conflitos futuros.

## 1. Remover o velho formulário V2 que sobrou dentro de `listing/`

O arquivo `src/components/orcamentos-v3/listing/NewQuoteFormV2.tsx` não é mais importado por ninguém (nem rota, nem outro componente). Ele só serve para arrastar consigo uma série de componentes que também ficaram órfãos.

Apagar:
- `listing/NewQuoteFormV2.tsx`
- `listing/SmartFinishingBlock.tsx`
- `listing/PrintingItemEditor.tsx`
- `listing/LaborAndSupplySubform.tsx`
- `listing/QuoteItemsTable.tsx`
- `listing/DiscountPaymentBlock.tsx`
- `listing/FreightSelector.tsx`
- `listing/ClientDetailsPanel.tsx`
- `listing/ClientLastSalesPanel.tsx`
- `listing/LoadFromGroupDialog.tsx`
- `listing/GenerateOrderButton.tsx`

(Verificar uma última vez que nada fora do próprio `NewQuoteFormV2` os importa antes de excluir.)

## 2. Mover tipos compartilhados para fora de `listing/`

Hoje arquivos sérios do V3 importam **tipos** de componentes que vivem em `listing/`, o que cria um acoplamento estranho:

- `CVItemState` é importado por `lib/quotes/options-pricing.ts`, `cart/QuoteAssistantPanelV3`, `cart/QuoteChecklistPanelV3` — mora em `listing/CVItemCard.tsx`.
- `ProcessStep` é importado por `lib/quotes/finishing-suggestions.ts`, `shared/productKit.ts`, `shared/bookletKit.ts`, `shared/useV3ProcessCatalog.ts`, `forms/LaborForm.tsx` — mora em `listing/ProcessPicker.tsx` e duplicado em `listing/QuoteItemsTable.tsx`.
- `StepType` vem de `listing/StepTypeBadge.tsx` e é usado por `pages/ProcessosProducao.tsx`.

Mover essas definições para `src/components/orcamentos-v3/types.ts` (ou um novo `shared/types.ts`) e atualizar os imports. Assim, se um dia o `listing/` for refatorado/renomeado, nada de lógica quebra.

## 3. Componentes que são genuinamente "shared", não "listing"

Vários componentes em `listing/` são, na prática, utilitários compartilhados — não pertencem à listagem nem ao viewer:

- `ClientCombobox` (usado em `pedidos/OrderEditorDialog` e no `NewQuoteFormV3`)
- `SupplySearch` (usado em `KitsProduto`, `GruposMateriais`, `BookletKitPanel`, `SupplyForm`)
- `ProcessPicker` (usado em `LaborForm`, `productKit`, `bookletKit`)
- `StepTypeBadge` (usado em `ProcessosProducao`)
- `QuoteStatusBadge` (usado em listagem **e** no client viewer)

Mover esses cinco para `src/components/orcamentos-v3/shared/` e atualizar imports. O restante de `listing/` (BulkActionBar, CloneQuoteButton, CreateVersionButton, GenerateOPButton, EngagementBadge, EngagementPopover, RealtimeRadar, UseTemplateDialog, QuoteAssistant, QuoteChecklist, QuoteOptionsBuilder, PriceBreakdown, StickyFinancialSidebar, CVItemCard) é realmente da listagem ou auxilia os painéis de carrinho — pode ficar.

## 4. Subpasta `client-viewer/` no lugar errado

`listing/client-viewer/*` é usado só por `pages/orcamentos-v3/ClientViewerV3.tsx`. Faz mais sentido viver em `src/components/orcamentos-v3/viewer/`. Mover a pasta e atualizar os 5 imports do `ClientViewerV3.tsx`.

## 5. Remover redirecionamentos V2 antigos (opcional)

Em `src/App.tsx` ainda existem:
```
/view-quote-v2/:id  → /
/orcamentos-v2      → /orcamentos
/orcamentos-v2/*    → /orcamentos
```
Se já faz tempo que ninguém usa esses links (e nenhum WhatsApp / e-mail antigo aponta para `/view-quote-v2/...`), podemos remover os três `<Route>`. Caso contrário, vale manter por mais alguns meses. **Recomendação:** manter por segurança — custa nada.

## 6. Pequeno detalhe: `product_kind`

A memória diz que `product_kind` é legado e o vínculo Kit↔Preset é via N:N. Ainda há refs em `KitsProduto.tsx`, `BusinessCardForm.tsx`, `ProductKitPanel.tsx`, `productKit.ts`, `useProductKitProcesses.ts` etc. **Não é parte desta limpeza** — exige análise funcional. Só registrando aqui como dívida técnica conhecida.

---

## Resumo do que será feito (se você aprovar)

1. Excluir `NewQuoteFormV2` + 10 componentes órfãos arrastados por ele.
2. Mover tipos `CVItemState`, `ProcessStep`, `StepType` para `shared/types.ts`.
3. Mover `ClientCombobox`, `SupplySearch`, `ProcessPicker`, `StepTypeBadge`, `QuoteStatusBadge` para `shared/`.
4. Mover `listing/client-viewer/` para `viewer/`.
5. Atualizar todos os imports impactados.

Não toco em redirecionamentos V2 (#5) nem em `product_kind` (#6).
