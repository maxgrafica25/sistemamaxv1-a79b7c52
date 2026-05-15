# Mover "papel já cortado" para o cadastro de Papel

## Por que esta correção

Você está certo — eu errei. Os papéis são entidades cadastradas em **Matérias-Primas → Papel** (tabela `papers`), e `printing_price_items.paper_type` apenas referencia o nome do papel (texto). "Já vem cortado" é uma propriedade física do papel (Sulfite A4 sempre é A4, em qualquer impressora), então pertence ao cadastro do papel, não ao item de preço.

O modelo atual (campos em `printing_price_items`) força marcar a flag em cada combinação papel × impressora × tamanho × frente/verso — duplicação e risco de inconsistência.

## Modelo final

### Banco
- **`papers`** ganha 3 colunas:
  - `is_cut_size boolean NOT NULL DEFAULT false`
  - `purchase_sheet_width_mm numeric NULL`
  - `purchase_sheet_height_mm numeric NULL`
- **`printing_price_items`** perde as 3 colunas adicionadas na migration anterior (revertendo o erro).

Como o vínculo papel→item é por **nome** (`papers.name` ↔ `printing_price_items.paper_type`), o motor resolve a flag no momento do cálculo via lookup por nome (já carregado no editor de orçamento).

### UI — Matérias-Primas (`src/pages/MateriasPrimas.tsx`, aba Papel)
No diálogo de cadastro/edição de papel, abaixo de gramatura:
- Switch **"Comprado já cortado no formato final"** (tooltip explicando: 1 folha = 1 peça, ignora aproveitamento).
- Bloco colapsável **"Folha de produção customizada (mm)"** com inputs largura × altura, desabilitado quando o switch está marcado.

### UI — Preço de Impressão (`src/pages/PrecoImpressao.tsx`)
- **Remover** o switch e o bloco de folha customizada do diálogo de item (foram adicionados no lugar errado).
- Opcional: badge informativa no item "Papel já cortado" quando o papel referenciado tiver a flag, só pra orientação visual.

### Motor de cálculo
- `resolvePaperSheet()` em `sheet-yield.ts` continua com a mesma assinatura (`PaperSheetSource`), só muda a origem dos dados.
- `PrintingItemEditor.tsx` e `NewQuoteFormV2.tsx`: ao buscar o item de impressão do catálogo, fazer lookup do papel por nome+gramatura em `papers` para obter `is_cut_size` / `purchase_sheet_*_mm`.
- `PrintingItemSearch` (`PrintingCatalogItem`) deixa de carregar esses 3 campos do item; passa a mesclá-los a partir do papel correspondente.
- Edge function `assistente-virtual`: nenhuma mudança funcional.

### Migração de dados
- Antes do `DROP COLUMN`, copiar `is_cut_size = true` de `printing_price_items` para `papers` agrupando por `(paper_type, grammage)` (caso você já tenha marcado algum durante os testes).
- `purchase_sheet_*_mm` idem.

## Testes
- Atualizar `src/test/sheet-yield.test.ts` para usar `PaperSheetSource` direto (já é o caso) — sem regressão.
- Adicionar smoke test garantindo que o lookup por nome+gramatura funciona (mock de `papers`).

## Fora de escopo
- Migrar o vínculo de texto para FK real (`papers.id`) — mudança maior, fica pra outra rodada.
- Calculadora de Etiquetas (já não usava as flags).

---

**Confirma que posso seguir?** A migration vai (1) adicionar 3 colunas em `papers`, (2) copiar dados existentes de `printing_price_items` → `papers` agrupando por nome+gramatura, (3) remover as 3 colunas de `printing_price_items`.
