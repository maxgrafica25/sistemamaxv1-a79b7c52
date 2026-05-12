## Objetivo

Refinar a apresentação do orçamento de apostilas para que (1) "preço por unidade" se refira à **apostila pronta** (não à página), (2) a sidebar deixe explícita a origem do "gap" entre a soma dos itens e o valor a cobrar, e (3) o rótulo do item siga mostrando o `sellingTotal`. Os pontos 3 e 4 do pedido (Tiers Manuais + precedência) já estão implementados — apenas validar nos testes manuais.

---

## 1. Motor (`src/lib/quotes-v2/pricing.ts`) — base "por apostila"

No ramo `isDirectSumItem` (apostilas), hoje `itemQty = m.quantity` representa **folhas cobradas**. Vamos derivar uma **base de exibição por apostila** sem mudar a matemática do cálculo:

- Detectar `bookletUnits` (qtd de apostilas) e `bookletPages` (folhas por apostila).
- Quando `bookletUnits > 0`, calcular um **fator de exibição** `pagesPerBooklet = m.quantity / bookletUnits` (ou `bookletPages` quando disponível).
- No objeto `PricingBreakdownItemDirectSum`, adicionar campos novos (sem remover os atuais — outras telas dependem deles):
  - `displayUnits: number` → `bookletUnits ?? itemQty`
  - `displayUnitLabel: "apostila" | "un"`
  - `pagesPerDisplayUnit: number` → fator multiplicador
  - `printingPerDisplayUnit`, `coversPerDisplayUnit`, `finishingPerDisplayUnit`, `laborPerDisplayUnit`, `salesCostPerDisplayUnit`, `subtotalPerDisplayUnit`, `sellingPriceDisplayUnit` → cada um igual ao valor "por página" multiplicado por `pagesPerDisplayUnit` (exceto labor, que fica `laborTotalAbs / displayUnits`).
- `sellingTotal` permanece igual (preço total do item).
- Para itens não-apostila (`bookletUnits` ausente), `displayUnits = itemQty`, `pagesPerDisplayUnit = 1` e os campos `*PerDisplayUnit` espelham os atuais `*PerUnit`.

Sem alteração no cálculo do total final — apenas novos campos derivados para a UI.

## 2. Breakdown (`src/components/orcamentos-v2/PriceBreakdown.tsx`)

`DirectSumBlock` e `DirectSumBody`:

- Trocar todos os `*PerUnit` exibidos por `*PerDisplayUnit`.
- Substituir o cabeçalho por `Resumo por ${displayUnitLabel}` (ex: "por apostila").
- Linha "Preço por unidade" → `Preço por ${displayUnitLabel}` usando `sellingPriceDisplayUnit`.
- Linha do total: `Total (${displayUnits} ${displayUnitLabel})`.
- No subtítulo da impressão (apostila), exibir `Impressão (${bookletPages} folhas × ${pagesPerDisplayUnit === bookletPages ? 'por apostila' : ''})` para reforçar o multiplicador.

## 3. Sidebar (`StickyFinancialSidebar.tsx`) — clareza do gap

O gap (~R$ 917) vem de: custos avulsos (labor/materials/terceiros/frete/extras) passando pelo divisor global de markup. Hoje a UI mostra acréscimos com prefixo `(-)` no DRE, o que confunde porque o valor final só sobe.

- Renomear `DRELine` para usar prefixo correto:
  - "(-) Custo de produção" permanece subtração.
  - Trocar "(-) Impostos / Cobrança / Margem de perdas" por **"(+) Impostos / Cobrança / Perdas / Margem"** quando o valor for positivo no contexto de markup global. Ajustar o sinal numérico para positivo nessas linhas.
- Adicionar uma linha **"Soma dos itens"** mostrando `printingTotal` agregado (já vem do composition) e logo abaixo **"Acréscimos sobre custos avulsos"** = diferença até `revenueBase`, com um tooltip detalhando frete + extras + labor avulsa + impostos.
- No bloco `PriceBreakdownGlobal` (`PriceBreakdown.tsx` linhas 213–249), corrigir os labels `(+) Impostos / Perda / Cobrança / Margem` (estão certos), mas **destacar visualmente** com cor de "acréscimo" (texto em `text-amber-600` ou similar) e adicionar linha de cabeçalho explicativa: *"Acréscimos aplicados sobre os custos avulsos (não passam pelos preços de cada item)"*.
- Remover o accordion DRE quando `onlyDirectSum && noStandaloneCosts` (caso atual em que o DRE só confunde).

## 4. Rótulo do item (`QuoteItemsTable.tsx`)

Já mostra `sellingTotal` (mudança recente). Apenas:

- Refinar o tooltip para sempre listar "Impressão / Acabamentos / Impostos" como linhas separadas quando `hasFinishes`.
- Sob o valor, mostrar microcopy `≡ R$ X / apostila` quando `bookletUnits > 0`, usando `sellingPriceDisplayUnit`.

## 5. Validação dos itens já implementados (3, 4 do pedido)

Apenas conferir manualmente:

- Cadastrar uma faixa em Matérias-Primas → "Gerenciar Faixas" e validar tooltip do filho mostrando "Preço final R$ X (TPn · a–b un)".
- Conferir precedência: tier manual aparece como "manual_tier"; sem tier ativa "margin"; sem nenhum dos dois cai em custo puro.

## 6. Memória

Atualizar `mem://features/pricing` com:

- Apostilas: a base de exibição é a **apostila pronta**, não a folha. UI usa campos `*PerDisplayUnit` e `displayUnits = bookletUnits`.
- DRE/sidebar: acréscimos de markup global usam prefixo `(+)`; subtrações reais usam `(-)`.

---

## Arquivos alterados

- `src/lib/quotes-v2/pricing.ts` (novos campos `*PerDisplayUnit` em `PricingBreakdownItemDirectSum`)
- `src/components/orcamentos-v2/PriceBreakdown.tsx` (consumir novos campos, melhorar labels de acréscimo)
- `src/components/orcamentos-v2/StickyFinancialSidebar.tsx` (corrigir sinais, esconder DRE redundante, microcopy)
- `src/components/orcamentos-v2/QuoteItemsTable.tsx` (tooltip detalhado + microcopy "/ apostila")
- atualização de `mem://features/pricing`