## Objetivo

Trazer para a aba **Apostila (V3)** a inteligência do **Kit Encadernação** da V2 — hoje o usuário precisa adicionar manualmente espiral, capa, contracapa e mão-de-obra (Furação/Encadernação) pelas abas Suprimentos e Mão-de-obra. A V3 já tem `getIdealSpiral()` ligado, mas não monta o kit.

## Como a V2 faz hoje (`SmartFinishingBlock`)

Quando o item é apostila, mostra o botão **"Sugerir Kit Encadernação · espiral 12mm"**. Ao clicar:

1. Procura no catálogo de suprimentos usando regex:
   - `FRONT_COVER_REGEX` → Capa PP Line A4 Incolor
   - `BACK_COVER_REGEX` → Capa PP Camurça A4 Preta
   - `spiralRegex(getIdealSpiral(folhas))` → espiral do diâmetro ideal
2. Adiciona cada suprimento como linha filha (quantidade = nº de apostilas), com preço por faixa.
3. Procura no catálogo de processos os passos que casam `BINDING_LABOR_PATTERNS` (Furação, Encadernação) e injeta como mão-de-obra com tempo × nº de apostilas.
4. Fallback: cria linhas "— preencher" e avisa por toast quando algo não foi encontrado no cadastro.

## O que mudar na V3

### 1. `BookletForm.tsx` — adicionar botão Kit + bloco de sugestões

- Carregar catálogo de suprimentos e processos via hooks já existentes (`useV3Catalog` precisa expor supplies, ou criar `useV3Supplies` espelhando o V2; processos via `useV3ProcessCatalog`).
- Acima do botão "Adicionar apostila", quando `bookletPages > 0 && bookletUnits > 0`, mostrar painel:
  - Botão primário **"Aplicar Kit Encadernação · espiral {diâmetro}"** (ícone Wand2).
  - Lista pré-visualizada (4 linhas com checkbox marcado por padrão) dos itens que serão adicionados:
    - Capa frontal · qtd = nº apostilas · preço
    - Contracapa · qtd = nº apostilas · preço
    - Espiral {diâmetro} · qtd = nº apostilas · preço
    - Furação + Encadernação · tempo × nº apostilas · custo
  - Usuário pode desmarcar itens individuais antes de aplicar.
- Substituir o callback `onAdd` por `onAddMany(items: V3Item[])` para empurrar a apostila + suprimentos + mão-de-obra em uma única ação.

### 2. Sugestões inteligentes contextuais (segunda camada)

Portar `getFinishingSuggestions()` da V2 (já existe em `src/lib/quotes-v2/finishing-suggestions.ts`) e mostrar chips logo abaixo do bloco Kit:

- Para apostila: `Refile`, `Montagem` (extras opcionais que não fazem parte do kit fixo).
- Clicar no chip adiciona uma linha de mão-de-obra avulsa direto no carrinho.

### 3. Sinalização visual

- Após aplicar o kit, mostrar toast `"Kit aplicado (4 itens). Espiral 12mm + capa + contracapa + mão-de-obra."`.
- No carrinho, agrupar visualmente os itens originados do kit (badge "Kit Encadernação" — opcional, fase 2).
- Substituir a frase atual ("Este valor cobre apenas o miolo…") pelo painel do Kit quando aplicável.

### 4. Reaproveitamento futuro

O mesmo padrão (botão "Aplicar Kit …" + lista pré-visualizada + `onAddMany`) servirá depois para os outros presets de produto (Banner com ilhós, Cartão com laminação, etc.) — manter o componente `KitSuggestionPanel` genérico, parametrizado por uma função `buildKitItems(context)`.

## Arquivos a tocar

- **Criar:** `src/components/orcamentos-v3/shared/useV3Supplies.ts` (hook compartilhado para carregar `supplies + pricing_tiers`).
- **Criar:** `src/components/orcamentos-v3/forms/KitSuggestionPanel.tsx` (UI reusável do kit).
- **Criar:** `src/components/orcamentos-v3/shared/bookletKit.ts` (função `buildBookletKit({ bookletPages, bookletUnits, supplies, steps, hourlyRate, margem })` que devolve `V3SupplyItem[] + V3LaborItem[]`).
- **Editar:** `src/components/orcamentos-v3/forms/BookletForm.tsx` — integrar o painel e trocar `onAdd` por `onAddMany`.
- **Editar:** `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` e `NewQuoteFormV3.tsx` — propagar `onAddMany`.
- **Editar (opcional):** `src/components/orcamentos-v3/cart/UnifiedCart.tsx` — badge "Kit" para itens com `meta.kitGroupId`.

## Validação

1. Apostila 12 folhas × 10 apostilas → botão mostra "espiral 7mm"; ao aplicar, carrinho recebe miolo + 3 suprimentos + 2 mão-de-obra com totais corretos.
2. Catálogo sem espiral 7mm cadastrada → linha "Espiral 7mm — preencher" com toast de aviso.
3. Aplicar duas vezes não duplica (idempotente por nome do produto no carrinho).
4. Mudar `bookletUnits` depois de aplicar **não** recalcula automaticamente (igual V3, simples); reaplicar Kit substitui.