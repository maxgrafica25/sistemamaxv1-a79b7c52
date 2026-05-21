## Engine V3: somar acabamentos no preço do Print

Hoje o `PrintForm` já lista acabamentos do catálogo unificado, mas o `valor_unitario`/`custo_unitario` do `V3PrintItem` só contém impressão + papel. Os chips marcados não impactam o total. Esta fase fecha o ciclo: chip ligado → custo somado por folha (ou por unidade) → refletido no preço unitário e no total do orçamento.

### 1. Estender `V3PrintItem` (`src/components/orcamentos-v3/types.ts`)

Trocar `finishings: string[]` por estrutura tipada, mantendo compat de exibição:

```ts
finishings: string[];               // labels — continua, p/ UI/descrição
finishing_selections?: {            // novo — drive do cálculo
  id: string;
  name: string;
  pricing_model: "per_sheet" | "per_unit";
  unit_label: string | null;
  price: number;                    // snapshot da unidade (R$/folha ou R$/un)
  cost: number;                     // mesmo snapshot — sem markup adicional
  units?: number;                   // só p/ per_unit (default = quantidade do item)
}[];
```

Snapshot evita recálculo divergente quando o catálogo mudar depois.

### 2. Helper de cálculo (`src/lib/finishings/catalog.ts`)

Adicionar:

```ts
export function sumFinishingsPerSheet(
  selections: { pricing_model; price; units? }[],
  sheets: number,
): { perSheet: number; perUnitTotal: number }
```

- `per_sheet` → soma direta em `perSheet`
- `per_unit`  → `price × (units ?? sheets)` acumulado em `perUnitTotal` (rateado fora)

### 3. PrintForm (`src/components/orcamentos-v3/forms/PrintForm.tsx`)

- Manter `finEnabled` como está
- Derivar `selections` a partir de `printFinishings` filtrando os ligados
- Em `buildItem(qty)`:
  - `extraPerSheet` = soma dos `per_sheet`
  - `extraPerUnit`  = soma dos `per_unit × (units ?? qty)`
  - `valor_unitario = pricing.sellingPrice + extraPerSheet + extraPerUnit/qty`
  - `custo_unitario = pricing.baseCost + extraPerSheet + extraPerUnit/qty`
  - Sem markup extra: acabamento é custo direto repassado (decisão prévia: catálogo já está com preço de venda)
- Chip "Total" no rodapé reflete automaticamente (já usa `sellingPrice × quantidade`)
- Pequeno breakdown abaixo do "Preço unitário" quando houver acabamentos: `+ R$ X,XX acab.`

### 4. Persistência

`finishing_selections` é serializável → entra direto no JSON do item ao salvar (caminho existente em `NewQuoteFormV3` / `UnifiedCart`). Nenhuma migration nova.

### 5. Tests

Adicionar `src/test/v3-print-finishings.test.ts` cobrindo:
- só per_sheet: soma direta
- só per_unit com `units` padrão = qty: rateio volta ao mesmo valor
- mistura dos dois
- nenhum acabamento: comportamento idêntico ao atual

### Fora de escopo

- Lona/banner (`FINISHES_LONA`/`FINISHES_BANNER`) seguem hardcoded — não têm preço no catálogo ainda
- Tiers por quantidade de acabamento (`finishing-pricing.ts`) — Calc Etiquetas usa, Print V3 ainda não; pode entrar em fase seguinte
- Booklet/Label items — escopo só do `V3PrintItem`

### Arquivos

- `src/components/orcamentos-v3/types.ts`
- `src/lib/finishings/catalog.ts`
- `src/components/orcamentos-v3/forms/PrintForm.tsx`
- `src/test/v3-print-finishings.test.ts` (novo)
