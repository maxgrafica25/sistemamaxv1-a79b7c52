# Paridade total V2 → V3

Escopo: trazer **todas as funcionalidades do módulo V2** para o V3, mantendo o layout split-screen (Tabs + Carrinho + Financeiro) já entregue nas Fases 1–5.

## Lacunas atuais (V3 hoje vs V2)

| Área | V2 | V3 | Falta |
|---|---|---|---|
| Tipos de item | Impressos, CV, Apostila, Terceiros, Mão-de-obra, Suprimento | Impressos, CV, Terceiros | **Apostila, Mão-de-obra, Suprimento** |
| Listagem `/orcamentos-v3` | OrcamentosV2.tsx (tabela, filtros, ações em massa) | só `/novo` | **Tela de listagem inteira** |
| Edição | EditQuoteV2.tsx | não existe | **Tela de edição (load + save)** |
| Cliente | ClientCombobox + DetailsPanel + LastSalesPanel | só campo simples | **Combobox + painel lateral** |
| Frete | FreightSelector | hardcoded | **Seletor de frete** |
| Desconto/Pagamento | DiscountPaymentBlock | só margem | **Bloco completo** |
| Opções (A/B/C) | QuoteOptionsBuilder | — | **Builder de opções** |
| Templates / Grupos | UseTemplateDialog + LoadFromGroupDialog | — | **2 diálogos** |
| Acabamentos inteligentes | SmartFinishingBlock + finishing-suggestions | progressivo simples | **Sugestões automáticas + CV** |
| Mão-de-obra/Suprimento por item | LaborAndSupplySubform + SupplySearch + ProcessPicker | — | **Subform inteiro** |
| Validação | QuoteChecklist | — | **Checklist** |
| Assistente IA | QuoteAssistant | — | **Painel do assistente** |
| Engajamento | EngagementBadge + Popover + RealtimeRadar | — | **3 componentes** |
| Ações | Clone, Nova Versão, GerarOP, GerarPedido, BulkActionBar | — | **5 ações** |
| Cliente público | client-viewer/ | — | **Página pública /q/:id** |
| Tracking | useScrollDepthTracking + tracking.ts | — | **Hook + lib** |

## Plano em 6 fases

### Fase 6 — Tipos de item faltantes (≈ 3 sub-passos)
- 6.1 `BookletForm.tsx` (Apostila): miolo + capa + acabamento (espiral/wire-o/grampo), reusando `spiral-selector.ts` e `sheet-yield.ts`.
- 6.2 `LaborForm.tsx` (Mão-de-obra avulsa) + `SupplyForm.tsx` (Suprimento avulso) com `ProcessPicker` e `SupplySearch` portados.
- 6.3 Estender `saveQuoteV3.ts` para persistir os 3 novos tipos em `quote_materials` / `quote_labor_steps`.

### Fase 7 — Cliente, Frete, Desconto, Pagamento (no Financeiro sidebar)
- 7.1 Portar `ClientCombobox` + `ClientDetailsPanel` + `ClientLastSalesPanel` para o V3.
- 7.2 Portar `FreightSelector` + `DiscountPaymentBlock` e plugar no engine.
- 7.3 Atualizar `pricing.ts` do V3 para refletir desconto/frete/forma de pagamento idêntico ao V2.

### Fase 8 — Tela de listagem + edição
- 8.1 Criar `/orcamentos-v3` reaproveitando 90% de `OrcamentosV2.tsx` (filtros, busca, paginação, bulk).
- 8.2 Criar `/orcamentos-v3/:id` (EditQuoteV3) com hidratação completa do `V3State` a partir do banco.
- 8.3 Trocar `useQuoteDraftV3` por modo "draft only para novos".

### Fase 9 — Recursos avançados
- 9.1 `QuoteOptionsBuilder` (orçamentos A/B/C).
- 9.2 `UseTemplateDialog` + `LoadFromGroupDialog`.
- 9.3 `SmartFinishingBlock` (sugestões automáticas via `finishing-suggestions.ts` e `cv-finishing-suggestions.ts`).
- 9.4 `LaborAndSupplySubform` (mão-de-obra/suprimento *por item* impresso).
- 9.5 `QuoteChecklist` + `QuoteAssistant`.

### Fase 10 — Ações e engajamento
- 10.1 Botões: `CloneQuoteButton`, `CreateVersionButton`, `GenerateOPButton`, `GenerateOrderButton`, `BulkActionBar`.
- 10.2 `EngagementBadge` + `EngagementPopover` + `RealtimeRadar`.
- 10.3 `StepTypeBadge` + `QuoteStatusBadge` no V3.

### Fase 11 — Viewer público + tracking + switch
- 11.1 Portar página `client-viewer/` para `/q/:id` compartilhada (V2 e V3 usam o mesmo viewer — já é o caso, validar).
- 11.2 Plugar `useScrollDepthTracking` e `tracking.ts` no viewer.
- 11.3 **Switch final:** trocar `/orcamentos` para apontar V3, manter V2 acessível em `/orcamentos-v2-legado` por 30 dias, depois remover.

## Estimativa

- Fase 6: ~1 turno
- Fase 7: ~1 turno
- Fase 8: ~2 turnos (listagem + edição são grandes)
- Fase 9: ~2 turnos
- Fase 10: ~1 turno
- Fase 11: ~1 turno

**Total: ~8 turnos de implementação**, validáveis incrementalmente após cada fase.

## Estratégia de execução

1. **Reuso máximo:** quando o componente V2 não depende de estado do `NewQuoteFormV2`, importo direto (zero cópia). Quando depende, crio adapter em `src/components/orcamentos-v3/adapters/` que traduz `V3State` ↔ props V2.
2. **Sem tocar no V2:** todo o V2 fica intacto e funcional durante a transição. Zero risco para produção.
3. **Validação por fase:** ao terminar cada fase, listo o que testar manualmente antes de seguir.
4. **Engine único:** `pricing.ts` do V2 continua sendo a fonte da verdade — V3 só monta o input.

## Como vamos prosseguir

Confirmando este plano, eu começo pela **Fase 6 (Apostila + Mão-de-obra + Suprimento)** agora, e ao final pergunto se sigo direto para Fase 7 ou se você quer testar primeiro.

Quer aprovar este roteiro?
