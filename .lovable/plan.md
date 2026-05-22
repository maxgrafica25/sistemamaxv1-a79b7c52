## Objetivo

Adicionar um novo sub-formulário **Cartão de Visita** dentro do módulo Impressão + Acabamentos (Orçamentos V3) que:
- Recebe a quantidade em **unidades de cartão** (ex: 1000).
- Calcula automaticamente quantos cartões cabem por folha SRA3 (32,8×47,8) considerando margens e gap entre cartões.
- Seleciona automaticamente o papel **Couchê 300g em SRA3** do catálogo (com toggle Frente / Frente+Verso).
- Expõe chips opcionais de **Corte pré-selecionado** e **Laminação** vindos do cadastro de acabamentos.
- Layout (folha, margens, gap e dimensão do cartão) **editável** na própria UI, com valores default já preenchidos.

## Arquivos novos

1. **`src/lib/orcamentos-v3/business-card-yield.ts`**
   - Função `calcCardsPerSheet({ sheetW, sheetH, marginMm, gapMm, cardW, cardH })`.
   - Calcula nas duas orientações (cartão em pé / deitado), retorna o melhor: `{ perSheet, cols, rows, orientation }`.
   - Fórmula por eixo: `floor((usable + gap) / (card + gap))`, onde `usable = sheet - 2*margin`.
   - Função `sheetsNeeded(qtyCards, perSheet) → ceil(qtyCards / perSheet)`.

2. **`src/components/orcamentos-v3/forms/BusinessCardForm.tsx`**
   - Props iguais ao `PrintForm` (`onAdd`, `descricao`, `onDescricaoChange`).
   - Estado:
     - `qtdCartoes` (default 1000)
     - `face`: `"frente" | "fv"` (default "frente")
     - Bloco "Layout da folha" (collapsible, fechado por default) com inputs: largura folha (32,8), altura folha (47,8), margem (7mm), gap (6mm), largura cartão (9), altura cartão (5). Defaults conforme pedido.
     - `finEnabled` map para chips Corte / Laminação.
   - Carregamento do catálogo via `useV3Catalog()`:
     - Filtra `items` por `paper_type` contendo "couchê" e `grammage` começando em "300" e `size` = "SRA3" (ou 32,8×47,8). Se houver vários, mostra um pequeno `select` interno; se zero, mostra alerta "Cadastrar papel Couchê 300g SRA3" linkando para `/preco-impressao`.
     - Aplica `side` conforme toggle F/V (busca registro F/V correspondente; se não existir, multiplica preço por 2 via `sideMult` já presente em `pricePerSheet`).
   - Carregamento de acabamentos via `listFinishings("impressao")` e filtra por nome regex `/corte/i` e `/lamina/i`. Renderiza apenas chips para os que existirem (usa o componente `FinishingProgressive` para coerência visual, mas com `items` reduzido).
   - Cálculo:
     - `perSheet = calcCardsPerSheet(...)`
     - `sheets = sheetsNeeded(qtd, perSheet)`
     - `pricing = pricePerSheet(catalogItem, tiers, sheets)`
     - `finishingExtraPerSheet = sumFinishingsPerSheet(selecionados, sheets)`
     - Preço total = `(pricing.sellingPrice + finishingExtraPerSheet) * sheets`
     - Preço por cartão (informativo) = total / qtd.
   - UI mostra um painel resumo: "**N cartões/folha** • **M folhas necessárias** • sobra X cartões".
   - `onAdd` emite um `V3PrintItem` (mesmo tipo já usado), com:
     - `quantidade = sheets` (folhas, para casar com a precificação)
     - `descricao` default "Cartão de visita 9×5cm — Couchê 300g {Frente|F/V}"
     - `finishings` = labels selecionados
     - `finishing_selections` populadas.

3. **`src/lib/quotes-v2/__tests__/business-card-yield.test.ts`** (opcional, mas barato)
   - Caso base: 32,8×47,8, margem 7, gap 6, cartão 9×5 → confirma `perSheet = 24` (3×8 vertical) ou orientação ótima.

## Arquivos alterados

4. **`src/components/orcamentos-v3/shared/productPresets.ts`**
   - Adiciona um novo `form` value `"business_card"` no tipo `ProductPreset.form`.
   - Atualiza o preset existente `cartao` para `form: "business_card"` (e remove os `hints` de papel, agora inúteis).

5. **`src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`**
   - Carrega presets do DB via `useQuotePresets`, então o tipo `form_tipo` vem da tabela `quote_presets`. Verificar se aceita "business_card"; caso o backend só aceite `print|booklet|label`, adicionar branch hard-coded: quando o preset selecionado tiver nome "Cartão de Visita" (ou id reconhecido), renderiza `<BusinessCardForm>` independente do `form_tipo`.
   - Importa e renderiza `<BusinessCardForm>` no novo branch.

6. **`src/pages/QuotePresets.tsx`** (verificar)
   - Se a tabela `quote_presets` tem CHECK em `form_tipo`, expor "Cartão de Visita" como opção no formulário de cadastro de preset, OU manter como preset built-in (sem migration) detectado por nome no wrapper. **Preferência: built-in** — adicionar lógica no wrapper para sempre exibir o chip "Cartão de Visita" independente do que houver no DB, evitando migration.

## Detalhes técnicos

- **Aproveitamento (default 32,8×47,8, margem 7mm, gap 6mm, cartão 9×5):**
  - Útil: 31,4 × 46,4 cm = 314 × 464 mm.
  - Vertical (cartão 9×5): cols = floor((314+6)/(90+6)) = 3, rows = floor((464+6)/(50+6)) = 8 → **24/folha**.
  - Horizontal (cartão 5×9): cols = floor(320/56) = 5, rows = floor(470/96) = 4 → 20/folha.
  - Engine escolhe 24.
- **F/V**: usa o mesmo `pricePerSheet` que já aplica `sideMult = 2`. Se existir item F/V cadastrado, prioriza esse; senão usa o item Frente e deixa o engine multiplicar.
- **Chips**: reaproveita `FinishingProgressive` (mesmo visual dos demais formulários). Cada chip só aparece se o acabamento estiver cadastrado em `/acabamentos` com nome casando o regex.
- **Sem migration de DB**: tudo lê do que já existe (`printing_price_items`, `finishings`).

## Fora do escopo

- Não altera tabelas, RLS ou edge functions.
- Não muda preset cadastrável pelo usuário (`/quote-presets`) — o chip "Cartão de Visita" passa a ser um built-in fixo no V3.
- Não mexe nos demais formulários (PrintForm, BookletForm, LabelEmbeddedForm).
