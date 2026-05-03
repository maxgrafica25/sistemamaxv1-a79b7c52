# Nomenclatura Dinâmica — Itens de Impressão (Orçamentos V2) — v2

## Objetivo
Padronizar o título técnico de cada item de impressão (lista do orçamento, PDF, OP) através de um título gerado a partir do produto escolhido + atributos estruturados vindos do catálogo + acabamentos vinculados. Sem regex, sem parsing de strings.

## Onde aplica
Card do `src/components/orcamentos-v2/PrintingItemEditor.tsx`. Não altera lógica de cálculo, busca de catálogo, CV ou ClientViewer.

## 1) Seletor de Produto Híbrido (topo do card)
- `Select` "Tipo de Produto": Cartão de Visita, Panfleto / Flyer, Folder, Cartaz, Receituário, Tag, Adesivo, Impresso, **Outro (Especificar)**.
- Se `productKind === "outro"`: `Input` ao lado para `customName`.

## 2) Título Dinâmico — só atributos estruturados (sem regex)
Fonte dos dados: as propriedades do `PrintingCatalogItem` que **já existem** quando o item é adicionado via `PrintingItemSearch` (`paper_type`, `grammage`, `size`, `side`, `equipment_name`).

Hoje esses campos só sobrevivem concatenados em `item.description`. A correção:
- Estender `PricingMaterial` com campos estruturados opcionais: `paperType`, `grammage`, `size`, `side`, `productKind`, `customName`, `reference`, `generatedTitle`.
- Em `addPrintingItem` (NewQuoteFormV2), preencher esses campos com os valores brutos do `PrintingCatalogItem` (sem montar string).
- `description` continua sendo gravada como fallback técnico, mas **não** é fonte do título.

Helper puro `src/lib/quotes-v2/item-title.ts`:
```ts
buildDynamicTitle({
  productLabel,          // do productKind / customName
  size,                  // ex.: "A4"
  paperType, grammage,   // ex.: "Couchê", "150g"
  side,                  // "F/V" → "4x4" | "Simples" → "4x0" | outro → undefined
  finishes,              // string[] dos description dos child materials
}): string
```
- Junta apenas os pedaços truthy com `" - "`. Cores derivam de um map fixo `{ "F/V": "4x4", "Simples": "4x0" }` — se `side` não bater, omite o pedaço.
- Acabamentos: junta com `" + "`; se vazio, omite.
- Garante zero hífens sobrando.

Exemplo: `Folder - A4 - Couchê 150g - 4x4 - 1 Dobra Central + Verniz`.

## 3) UX no card
- Banner read-only no topo (antes do header):
  `text-lg font-bold text-primary bg-primary/5 p-3 rounded-lg border border-primary/10`
- Conteúdo do banner = `generatedTitle` recomputado em tempo real (memo) sempre que `productKind`, `customName`, atributos do item ou `childMaterials` mudarem.
- `item.description` (texto técnico do catálogo) vira sub-texto pequeno (`text-xs text-muted-foreground`) **abaixo** do banner — apenas referência interna, não editável.

## 4) Campo "Referência / Campanha"
- `Input` opcional, label "Referência / Campanha", placeholder "Ex.: Promoção Dia das Mães".
- Salvo em `reference`. Vai para PDF/OP, não afeta cálculo.

## 5) Persistência — tabela correta
Confirmado via inspeção do schema: a tabela é **`public.quote_materials`** (não existe `quote_items`). Itens-pai de impressão e filhos (acabamentos vinculados) vivem nela com `parent_item_id`.

Migration adicionando colunas (todas nullable, sem default que altere existentes):
- `product_kind text`
- `custom_name text`
- `reference text`
- `generated_title text`
- `paper_type text`
- `grammage text`
- `size text`
- `side text`

Atualizar:
- `src/lib/quotes-v2/pricing.ts`: estender `PricingMaterial` com os campos acima.
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`:
  - `addPrintingItem`: gravar atributos estruturados a partir do `PrintingCatalogItem`.
  - Insert/update de `quote_materials`: incluir as novas colunas.
  - Mapper de carga (`dbRow → PricingMaterial`): hidratar os novos campos. Para itens antigos sem esses dados, manter fallback exibindo `description` no banner.
  - Recalcular `generated_title` no save (server-of-truth) chamando `buildDynamicTitle` antes do upsert.
- `src/components/orcamentos-v2/PrintingItemEditor.tsx`: nova UI + propagação via `onItemChange`.
- `src/lib/erp/production-order-pdf.ts` e gerador de PDF do orçamento: usar `generated_title` quando presente (fallback `description`); imprimir `Ref.: {reference}` abaixo quando houver.

## 6) Fora de escopo
- Sem mudanças em `LaborAndSupplySubform`, motor de preço, catálogo, CV.
- Sem novos dropdowns de Formato/Papel/Cores no card — tudo vem dos atributos estruturados do item de catálogo já escolhido.

## Arquivos afetados
- Migration nova em `quote_materials`.
- `src/lib/quotes-v2/item-title.ts` (novo helper).
- `src/lib/quotes-v2/pricing.ts` (tipo).
- `src/components/orcamentos-v2/PrintingItemEditor.tsx` (UI).
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (add/load/save).
- `src/lib/erp/production-order-pdf.ts` + PDF do orçamento (consumo).
