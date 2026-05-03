## Objetivo

Bifurcar a Calculadora de Etiquetas em dois modos de corte: **Plotter (SignMaster)** — comportamento atual — e **Guilhotina** — novo motor com margens fixas de 5 mm, gap de 3 mm e teste automático de orientação. O modo é apenas estado de UI (não persiste em config).

**RESPEITAR o layout atual de 2 colunas** (`grid gap-6 lg:grid-cols-2`). Nenhuma alteração estrutural no grid da página. A Coluna da Esquerda (Painel de Controle) recebe o novo Card do `ToggleGroup` de "Tipo de corte"; a Coluna da Direita (Preview + ações) continua intacta — apenas componentes internos recebem a lógica de bifurcação.

## Arquivos a modificar

### 1. `src/lib/labels/guilhotina.ts` (novo)

Motor puro, independente da config:

```ts
export const GUILLOTINE_MARGIN_MM = 5;
export const GUILLOTINE_GAP_MM = 3;

export interface GuillotineInput { sheetW: number; sheetH: number; labelW: number; labelH: number; }
export interface GuillotineLayout {
  cols: number; rows: number; total: number;
  labelW: number; labelH: number; rotated: boolean;
  usableW: number; usableH: number;
  offsetX: number; offsetY: number;
  utilizationPct: number;
  positions: Array<{ x: number; y: number; col: number; row: number }>;
}
export function computeGuillotineLayout(input: GuillotineInput): GuillotineLayout;
export function findGuillotineShrinkOpportunity(...): ShrinkSuggestion | null;
export function findGuillotineGrowOpportunity(...): GrowSuggestion | null;
```

Algoritmo:
- `usableW = sheetW − 10`, `usableH = sheetH − 10`.
- Para cada orientação (W×H e H×W): `cols = floor((usableW + 3) / (lw + 3))`, idem `rows`. `total = cols·rows`.
- Escolhe orientação com maior total (desempate: maior área usada).
- Centraliza grade na área útil → `offsetX/offsetY`.
- `utilizationPct = (total · lw · lh) / (usableW · usableH) · 100`.

### 2. `src/components/labels/LabelLayoutCalculator.tsx`

**Estado novo (não persiste):**
```ts
const [cutMode, setCutMode] = useState<"plotter" | "guilhotina">("plotter");
```

**Seletor visual** — adicionar Card com `ToggleGroup` na **Coluna da Esquerda**, imediatamente após o Card de seleção rápida de folha (linhas ~667-694) e antes do Card "Simulador":

```tsx
<Card className="p-3">
  <Label className="text-xs text-muted-foreground mb-2 block">Tipo de corte</Label>
  <ToggleGroup type="single" value={cutMode} onValueChange={(v) => v && setCutMode(v as any)}
    className="grid grid-cols-2 gap-1.5">
    <ToggleGroupItem value="plotter" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-9 text-xs">
      Plotter (SignMaster)
    </ToggleGroupItem>
    <ToggleGroupItem value="guilhotina" className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground border h-9 text-xs">
      Guilhotina
    </ToggleGroupItem>
  </ToggleGroup>
</Card>
```

**Bifurcação do cálculo:**
```ts
const guillotineLayout = useMemo(
  () => cutMode === "guilhotina"
    ? computeGuillotineLayout({ sheetW: config.sheetW, sheetH: config.sheetH, labelW, labelH })
    : null,
  [cutMode, config.sheetW, config.sheetH, labelW, labelH],
);
```

No `useMemo` que monta `layout` (linhas 401-424), priorizar `guillotineLayout` sobre `paramLayout`/`layoutGeneric`, normalizando para o mesmo shape (`best`, `usableW`, `usableH`, `utilizationPct`, `cellsPerRow`, `rowOffsets`, `effectivePerSheet`, `reservedSlots: []`).

Forçar `isParametric = false` quando `cutMode === "guilhotina"` (desativa caminho SignMaster e o botão `.plt`).

**Sugestões shrink/grow** (linhas 442-458): em modo guilhotina, usar `findGuillotineShrinkOpportunity` / `findGuillotineGrowOpportunity` (mesma assinatura de retorno).

**`nearMissColumn`** (linhas 482-517): retornar `null` quando guilhotina (gap fixo).

**Limpeza condicional de UI na Coluna da Direita** (`cutMode === "guilhotina"`):
- Esconder banner SignMaster (linhas 927-934) → wrap em `{cutMode === "plotter" && (...)}`.
- Esconder Badge "−N (zona de segurança 10mm)" (linhas 962-967) → adicionar `cutMode === "plotter"` à condição.
- Texto "área útil … gap …" reflete 5 mm/3 mm em modo guilhotina.
- Botão "Baixar faca .plt" some automaticamente (já condicionado a `isParametric`).

**Preview SVG (`SheetPreview`):**

Adicionar props `cutMode` e `guillotineLayout`. Quando `cutMode === "guilhotina"`:
- Não renderizar marcas L/T.
- Renderizar retângulo da folha + retângulo pontilhado da área útil (offset 5 mm).
- Renderizar peças em `guillotineLayout.positions` (round → círculo, demais → retângulo).
- Não renderizar `reservedSlots`.

### 3. Card de orçamento

**Sem mudanças estruturais.** `perSheet` já vem de `layout.effectivePerSheet`, então cálculo de folhas e total funcionam automaticamente.

## Critérios de aceite

- Grid `grid gap-6 lg:grid-cols-2` **preservado**.
- Toggle "Plotter / Guilhotina" aparece na Coluna da Esquerda, padrão Plotter.
- Em Plotter: comportamento atual idêntico (testes SignMaster continuam passando).
- Em Guilhotina: peça 50×30 mm em SRA3 (320×450) → área útil 310×440, testa as duas orientações; preview mostra apenas folha + área útil pontilhada + grid com gap 3 mm.
- Banner SignMaster, badge de zona de segurança e botão `.plt` somem em modo guilhotina.
- Card de orçamento recalcula `sheetsNeeded` e total usando o novo `perSheet`.

## Fora de escopo

- Persistir `cutMode` em `LabelCalcConfig`.
- Geração de PDF/.plt específica para guilhotina.
- Qualquer alteração no grid da página, paleta ou tipografia.
