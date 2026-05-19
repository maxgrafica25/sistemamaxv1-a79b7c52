# Orçamento V3 — Scaffold + Fases 1–4

Implementação **isolada** em `src/components/orcamentos-v3/` e rota `/orcamentos-v3/novo`. Zero alteração no V2. Inclui as fases 1–4 do rollout. A fase 5 (persistência real + swap de rota padrão) só após QA aprovado pelo usuário.

## Arquivos a criar

### Rota
- `src/App.tsx` — adicionar `<Route path="/orcamentos-v3/novo" element={<NewQuoteV3 />} />` + import.
- `src/pages/orcamentos-v3/NewQuoteV3.tsx` — page wrapper com navigate.

### Componente principal
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` — orquestrador: header (Voltar · badge V3 beta · cliente · assunto · salvar), grid `lg:grid-cols-[1fr_360px]`, atalhos `Alt+1/2/3`, auto-save + restauração de rascunho com toast.
- `src/components/orcamentos-v3/types.ts` — `V3Item` (print | cv | third), `V3QuoteState`, `DEFAULT_STATE` (cliente = "Cliente Balcão").

### Workspace (70%)
- `src/components/orcamentos-v3/workspace/TabsLayout.tsx` — segmented control discreto (border-bottom na ativa, ícone Lucide + kbd do atalho).

### Forms
- `src/components/orcamentos-v3/forms/PrintForm.tsx` — descrição, qtd, custo/valor unit, chips de Cores (4x0/4x4/1x0/1x1), Formato (A4/A3/SRA3), Face (frente/F+V), acabamentos toggle, botão "Adicionar" que pisca verde.
- `src/components/orcamentos-v3/forms/CVForm.tsx` — descrição, autocomplete de mídia (Supabase `midias_cv`), largura/altura inline com m² calculado, custo m² + margem, acabamentos toggle, preview do total.
- `src/components/orcamentos-v3/forms/ThirdPartyForm.tsx` — descrição, autocomplete de fornecedor (`suppliers`), qtd, custo, margem, preview.

### Cart (30%)
- `src/components/orcamentos-v3/cart/UnifiedCart.tsx` — lista compacta com ícone por categoria, badge, qtd, preço, ações Duplicar/Excluir; estado vazio com ícone; animação suave no item recém-adicionado.
- `src/components/orcamentos-v3/cart/FinancialPanel.tsx` — Subtotal, Impostos, Taxas, Total a cobrar, Margem (cor pelo valor). Visual minimalista.
- `MobileCart` (dentro do NewQuoteFormV3) — bottom-sheet expansível.

### Shared
- `src/components/orcamentos-v3/shared/ChipGroup.tsx` — grupo de chips ativável.
- `src/components/orcamentos-v3/shared/PaperAutocomplete.tsx` — autocomplete genérico ligado ao Supabase (tabela + colunas configuráveis), debounce 200ms.
- `src/components/orcamentos-v3/shared/FinishingProgressive.tsx` — lista de toggles; conteúdo avançado só aparece quando ativo (progressive disclosure).
- `src/components/orcamentos-v3/shared/useQuoteDraftV3.ts` — auto-save em `localStorage` com debounce 800ms, TTL 7 dias, restauração na montagem, `clear()`.
- `src/components/orcamentos-v3/shared/pricing.ts` — `priceOf(item)`, `summarize(items, tax, fees, margin)`, `roundUp10` (regra global R$ 0,10), `fmtBRL`.

### Entrada beta no V2
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — adicionar botão pequeno "Experimentar V3 (beta)" no header que navega para `/orcamentos-v3/novo`.

## Escopo deliberadamente fora desta entrega

- **Persistência no banco** (Fase 5). `onSave` apenas valida + limpa rascunho e mostra toast. Quando aprovado o UX, plugamos no mesmo `quotes`/`quote_items` do V2.
- **Recompute via `lib/quotes-v2/pricing.ts` completo** (com tiers, materiais, etapas). V3 começa com cálculo direto (custo × qtd × margem + R$ 0,10 round) para validar o **fluxo de UI**. Engine completa é trocada na Fase 5 sem mexer na UI.
- Edição de orçamento existente (`/orcamentos-v3/:id`). V3 começa só com criação.

## Validação após implementar

1. Acessar `/orcamentos-v3/novo` direto e via botão beta no V2.
2. Trocar abas com `Alt+1/2/3`.
3. Adicionar 1 item por categoria → ver no carrinho à direita + total atualizando.
4. Duplicar e excluir do carrinho.
5. Recarregar a página → toast "Rascunho restaurado" + itens preservados.
6. Mobile (394×728): cart vira bottom-sheet expansível.

**Pode confirmar para eu sair do plan mode e implementar?**
