# Onda 3 — Tudo que falta no V3 + deleção do V2

Objetivo: depois desta onda, a pasta `src/components/orcamentos-v2/` e os arquivos `NewQuoteV2.tsx`/`EditQuoteV2.tsx`/`ClientViewer.tsx` (v2) podem sumir sem perda funcional. Vou avisar explicitamente "agora pode deletar".

A execução acontece em 4 passos dentro da mesma onda. Cada passo é uma entrega utilizável; o "ok para deletar" sai só no final do passo 4.

---

## Passo 1 — Mover utilitários compartilhados (destrava o V2)

Hoje o V3 ainda importa estes 5 utilitários da pasta V2:
`SupplySearch`, `ClientCombobox`, `ProcessPicker`, `CVItemCard` (tipo), `StepTypeBadge`.

Mover todos para `src/components/orcamentos-v3/shared/` e reescrever os imports em:
`NewQuoteFormV3.tsx`, `forms/BookletKitPanel.tsx`, `forms/LaborForm.tsx`, `forms/SupplyForm.tsx`, `shared/bookletKit.ts`, `shared/productKit.ts`, `shared/useV3ProcessCatalog.ts`, `components/kits/VariantsDialog.tsx`, `components/pedidos/OrderEditorDialog.tsx`, `lib/quotes-v2/finishing-suggestions.ts`, `lib/quotes-v2/options-pricing.ts`, `pages/GruposMateriais.tsx`, `pages/ProcessosProducao.tsx`.

`src/lib/quotes-v2/*` (pricing, options, temperature, whatsapp, tracking, etc.) fica como está — é biblioteca de regras de negócio, não UI V2. Renomear seria poluição sem ganho.

---

## Passo 2 — V3: Checklist + Assistant

Portar dois blocos do formulário V2 para dentro de `NewQuoteFormV3.tsx`, ambos como abas/cards opcionais no painel lateral:

- **QuoteChecklist** — copiar `QuoteChecklist.tsx` para `orcamentos-v3/shared/` e instanciar dentro do form V3 usando `quoteId` (após save), `cvItems` e materiais derivados dos itens V3 de CV. Persistência continua via tabelas existentes (`quote_checklist_answers`). Hook `onAutoLaborChange` adiciona/remove um `V3LaborItem` no carrinho V3 quando a resposta vira "Sim".
- **QuoteAssistant** — copiar para `orcamentos-v3/shared/`. Painel de sugestões IA que lê histórico do cliente, tags e itens atuais. Aceitar uma sugestão chama o mesmo dispatcher do carrinho V3 que adiciona um item.

Ambos ficam dentro de um `<Tabs>` colapsável no lado direito, abaixo do `FinancialPanel`.

---

## Passo 3 — V3: Opções A/B/C

Maior parte do trabalho. Esquema do DB (`quotes.options` jsonb + `quote_materials.option_id`) já existe e é o que o V2 e o ClientViewer V3 leem.

Implementação V3:
- Novo bloco `QuoteOptionsBuilderV3` em `src/components/orcamentos-v3/shared/`, baseado no V2 mas operando sobre o estado V3 (carrinho unificado).
- Modelo: cada opção é um "preset de quantidade + multiplicador" sobre o total atual; gera entradas em `quotes.options` no mesmo formato `QuoteOption[]` que o V2 e o ClientViewer já entendem.
- Cálculo via `recalculateForQuantity` (já existe em `lib/quotes-v2/pricing.ts`) alimentado por um `PricingSnapshot` montado a partir do carrinho V3 no `saveQuoteV3`.
- O `ClientViewerV3` já renderiza opções (foi copiado do V2). Garantir que continua escolhendo e aprovando uma opção específica.

Atalhos: ½×, 2×, 3×, 5×, customizado. UX no card de "Quantidade principal" + lista de opções abaixo do carrinho.

---

## Passo 4 — Aposentar e deletar V2

1. **Editor V2 → read-only/redirect:** `EditQuoteV2` e `NewQuoteV2` deixam de existir. Rotas `/orcamentos-v2/novo` e `/orcamentos-v2/:id` redirecionam para `/orcamentos`. Se o usuário clicar numa linha de orçamento criado no V2 (sem `v3_payload`), a listagem abre o `ClientViewerV3` em modo leitura com banner "Orçamento legado — somente visualização".
2. **App.tsx:** remover imports de `OrcamentosV2`, `NewQuoteV2`, `EditQuoteV2`, `ClientViewer` (v2). Manter só `OrcamentosV3`, `NewQuoteV3`, `ClientViewerV3`.
3. **Deletar arquivos:**
   - `src/pages/orcamentos-v2/` inteira
   - `src/components/orcamentos-v2/` inteira (já foi copiada para `orcamentos-v3/listing` no passo anterior; este passo só remove o original)
4. Verificar `tsc`/build limpo, console sem erros.
5. Mensagem para você: **"V2 pode ser deletado — feito."**

`src/lib/quotes-v2/` permanece (lib de regras).

---

## Fora desta onda

- Anexos por orçamento e UI explícita de Tags ainda no V3 form — entram numa Onda 4 curta, se você sentir falta.
- Repolimento visual final do `OrcamentosV3` e `ClientViewerV3` no padrão minimalista V3 (hoje estão idênticos ao V2 visualmente).

---

## Arquivos tocados (resumo)

**Novos**
- `src/components/orcamentos-v3/shared/SupplySearch.tsx`, `ClientCombobox.tsx`, `ProcessPicker.tsx`, `CVItemCard.tsx`, `StepTypeBadge.tsx` (movidos)
- `src/components/orcamentos-v3/shared/QuoteChecklist.tsx`, `QuoteAssistant.tsx`, `QuoteOptionsBuilderV3.tsx` (portados)

**Editados**
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (integra os 3 blocos)
- `src/components/orcamentos-v3/shared/saveQuoteV3.ts` (persistir `options` e `option_id` por item)
- `src/components/orcamentos-v3/shared/loadQuoteV3.ts` (carregar `options`)
- `src/pages/orcamentos-v3/OrcamentosV3.tsx` (clique em quote V2 antigo → viewer read-only)
- `src/App.tsx` (remover rotas/imports V2)
- Todos os arquivos que importavam de `@/components/orcamentos-v2/` (rewire para `orcamentos-v3/shared/`)

**Deletados**
- `src/pages/orcamentos-v2/` (4 arquivos)
- `src/components/orcamentos-v2/` (30+ arquivos)

Sem migrations.
