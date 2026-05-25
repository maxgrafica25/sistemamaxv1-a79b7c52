
## Objetivo

Quando o usuário escolher o favorito **Certificados** na aba *Impressão + Acabamentos*, abrir um formulário dedicado — nos moldes do Cartão de Visita — com **Couchê 210g A4** pré-selecionado do catálogo de Preço de Impressão e seletor de **face** (Frente / Frente e Verso, ambas color).

Hoje o preset Certificados (salvo em `quote_presets`) cai no `PrintForm` genérico. A ideia é dar a ele o mesmo tratamento especial que já existe para "Cartão de Visita".

## O que muda

### 1. Novo formulário `CertificateForm.tsx`

Criar `src/components/orcamentos-v3/forms/CertificateForm.tsx` espelhando a estrutura do `BusinessCardForm`, com:

- **Catálogo auto-detectado**: filtra `items` de `useV3Catalog` por `paper_type` contendo "couch" + `grammage` "210" + `size` "A4" (case-insensitive). Se mais de um item casar (diferentes impressoras color), mostrar o `<select>` igual ao do CV.
- **Quantidade**: input numérico em "unidades" (= folhas, pois 1 certificado = 1 folha A4). Sem cálculo de aproveitamento — não há layout, é 1 por folha.
- **Face**: dois cards (mesmo padrão visual do CV) — `Frente` e `Frente e Verso`. Sem opção de mix color/PB nesta versão.
- **Acabamentos**: reusa o mesmo padrão do CV via `useProductKitProcesses("certificado")` (fixos sempre on; opcionais opt-in). Se nenhum `product_kit` desse tipo existir, painel fica vazio (sem quebrar).
- **Preço**: `pricePerSheet(effectiveItem, tiers, sheets)` somado ao custo por folha dos acabamentos selecionados; `effectiveItem.side` é forçado para `F/V` ou `Frente` para que o engine aplique o multiplicador 2x corretamente.
- **Submit**: emite um `V3PrintItem` com `catalog_item_id`, `paper_type`, `grammage`, `size`, `side`, `face`, `finishings`, `finishing_selections`, descrição padrão `"Certificado A4 — Couchê 210g {Face} ({n} un)"`.

### 2. Roteamento do preset → formulário

Em `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`:

- Adicionar `isCertificateName(nome)` (regex `/certificad/` após normalizar acentos), análogo a `isBusinessCardName`.
- Calcular `treatAsCertificate = !!selectedPreset && isCertificateName(selectedPreset.nome)`.
- No bloco de render do sub-formulário, antes do fallback `formTipo === "print"`, renderizar `<CertificateForm … />` quando `treatAsCertificate`.
- Não criar chip embutido (como o do CV) — o preset "Certificados" do usuário já existe em `quote_presets`.

### 3. Catálogo vazio

Se não houver Couchê 210g A4 cadastrado, mostrar o mesmo aviso do CV ("Nenhum item … cadastrado") com link para `/preco-impressao`.

## Fora de escopo

- Mix "Frente color + Verso P&B" (descartado pelo usuário).
- Alterar `PRODUCT_PRESETS` / `productPresets.ts` (presets built-in continuam como estão).
- Mexer em `productSuggester` (Certificados não vira sugestão automática agora).
- Mexer em `useV3Catalog`, `pricePerSheet` ou tipos.

## Arquivos

- **Criar**: `src/components/orcamentos-v3/forms/CertificateForm.tsx`
- **Editar**: `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
