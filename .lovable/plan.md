## Objetivo

Criar a **Calculadora de Aproveitamento de Etiquetas** com:
- Tipo de corte (Corte Reto, Plotter Quadrado, Plotter Redondo) com defaults próprios.
- Margens **direcionais** (top/bottom/left/right) — marca de registro afeta principalmente topo/base.
- 3 regras novas: precificação por folha, ancoragem de upsell, otimizador de retalho (−1/−2/−3mm).

Tudo client-side; persistência só de "preço da folha" no `localStorage`.

## Arquitetura

```text
src/
├── lib/labels/
│   └── layout.ts                        ← lógica pura, testável
├── components/labels/
│   ├── LabelLayoutCalculator.tsx        ← UI principal (reutilizável)
│   └── LabelLayoutDialog.tsx            ← wrapper para abrir do orçamento
├── pages/
│   └── CalculadoraEtiquetas.tsx         ← página standalone
└── test/
    └── labels-layout.test.ts            ← cobre as 4 funções principais
```

## `lib/labels/layout.ts` — exports

| Função | Responsabilidade |
|---|---|
| `CutType`, `CUT_DEFAULTS`, `CUT_LABELS` | Tipos de corte e defaults de margem/gap |
| `SHEET_PRESETS` | A4, A3, SRA3, Carta + custom |
| `computeLabelLayout(input)` | Calcula melhor entre normal e rotacionada 90° |
| `sheetsNeeded(qty, perSheet)` | `ceil(qty / perSheet)` |
| `roundUpToTen(n)` | Arredonda para cima ao R$ 0,10 (regra do projeto) |
| `computeSheetPricing({ pricePerSheet, qtyRequested, perSheet })` | Total + unitário |
| `pickRoundUpsellQty(qty)` | Faixas confirmadas: 200/300/500/1000/2000/qty×5 |
| `buildAnchoringLadder(qty, perSheet, pricePerSheet)` | 3 tiers com dedup, % vs base |
| `findShrinkOpportunity(base, originalPerSheet, sheetsForOriginal)` | Testa −1/−2/−3mm em W, H e ambos. Trava em 5mm mínimos. Maior delta vence; empate → menor encolhimento |

### Defaults por tipo de corte (mm)

| Tipo | Top | Bottom | Left | Right | Gap |
|---|---|---|---|---|---|
| Corte reto (guilhotina) | 5 | 5 | 5 | 5 | 0 |
| Plotter quadrado | 10 | 10 | 5 | 5 | 2 |
| Plotter redondo | 10 | 10 | 5 | 5 | 3 |

Cada margem fica editável após escolher o tipo (o tipo só pré-preenche).

### Cálculo do layout (chave)

Para N peças em uma direção: `N*lado + (N−1)*gap ≤ útil` → `N = floor((útil + gap) / (lado + gap))`. Testa orientação 0° e 90°, escolhe a que dá mais. Aproveitamento = `(total × labelArea) / (usableW × usableH) × 100`.

## `components/labels/LabelLayoutCalculator.tsx`

Layout em 2 colunas (preview à direita em md+):

**Coluna esquerda — controles (em seções colapsáveis ou cards)**
1. **Folha**: select com presets + botão "Personalizado" → mostra inputs W×H.
2. **Tipo de corte**: 3 botões/segmented control. Ao trocar, sobrescreve margens/gap com os defaults do tipo (mostra um botão "Restaurar padrões" caso o usuário tenha editado).
3. **Margens direcionais**: 4 inputs (Top, Bottom, Left, Right) em grid 2×2 + input "Espaçamento entre etiquetas (gap)".
4. **Etiqueta**: 2 inputs W×H (mm).
5. **Quantidade desejada**: input numérico.
6. **Preço da folha de produção (R$)**: input numérico, persistido em `localStorage` (`labelCalc:lastPricePerSheet`).

**Coluna direita — resultados**
- **Card de aproveitamento**: "X etiquetas por folha" + "Y% aproveitamento" + badge "Etiqueta em pé" ou "Etiqueta deitada (rotação 90°)". Mostra também `cols × rows`.
- **SVG de preview** (escala proporcional, max 360×360px): folha cinza com margens hachuradas + grade de etiquetas roxas. Etiqueta rotacionada se for o caso.
- **Card "Cálculo do orçamento"** (aparece quando preço e qty preenchidos):
  - `qty desejada` ÷ `por folha` = **N folhas** × R$ preço = **R$ total** _(unit: R$ X,XX)_
- **Tabela de ancoragem** (3 linhas):
  ```
  Quantidade | Folhas | Total      | Custo/un | Δ vs solicitada
  50  un     | 1      | R$ 15,00   | R$ 0,30  | —
  100 un     | 2      | R$ 30,00   | R$ 0,30  | 0%
  300 un     | 5      | R$ 75,00   | R$ 0,25  | −17% (badge verde)
  ```
- **Alerta de otimização** (Lightbulb amarelo, só se sugestão existe):
  > 💡 **Dica:** Se a etiqueta for reduzida para **48×48mm** (−2mm × −2mm), cabem **+12 por folha**. Pelo mesmo custo (5 folhas) o cliente leva **+60 etiquetas**.
  >
  > [Aplicar sugestão] (botão pequeno, substitui labelW/labelH e re-calcula)

Quando usado dentro de um item de impressão do orçamento, o card de "Cálculo do orçamento" ganha um botão extra **"Usar X folhas como quantidade"** (via prop `onApply`).

## `components/labels/LabelLayoutDialog.tsx`

`Dialog` simples (max-w-4xl). Props:
```ts
{
  open: boolean;
  onOpenChange: (b: boolean) => void;
  defaultSheet?: { width: number; height: number };
  defaultLabelW?: number;
  defaultLabelH?: number;
  defaultQty?: number;
  onApply?: (folhas: number) => void;
}
```
Renderiza `<LabelLayoutCalculator />` repassando as defaults.

## `pages/CalculadoraEtiquetas.tsx`

Página simples seguindo o padrão dos outros módulos do projeto:
- Título com ícone Lucide `Ruler` em primary purple.
- Renderiza `<LabelLayoutCalculator />` em largura total.
- Sem `onApply` (uso standalone).

## Integrações

### `App.tsx`
Adicionar:
```tsx
import CalculadoraEtiquetas from "./pages/CalculadoraEtiquetas";
// dentro de ProtectedRoute/Layout:
<Route path="/calculadora-etiquetas" element={<CalculadoraEtiquetas />} />
```

### `Sidebar.tsx`
No grupo **Precificação** (entre "Preço Impressão" e "Processos de Produção"):
```tsx
{ name: "Calc. Etiquetas", href: "/calculadora-etiquetas", icon: Ruler }
```
Visível para todos (admin + colaborador) — ferramenta operacional.

### `components/orcamentos-v2/PrintingItemEditor.tsx`
No header do item, ao lado do `<Input quantity>`, adicionar botão pequeno (ícone `Ruler`, `variant="ghost" size="icon"`, tooltip "Calcular etiquetas por folha"). Ao clicar, abre `LabelLayoutDialog` com:
- `defaultSheet`: derivado de `item.description` se contiver "A4"/"A3"/"SRA3" (regex simples)
- `defaultQty`: `item.quantity`
- `onApply: (folhas) => onItemChange({ quantity: folhas })`

Fica desabilitado se o item estiver `aprovado` (segue o padrão atual).

## Testes (`src/test/labels-layout.test.ts`)

Cobertura mínima:

1. **`computeLabelLayout`**
   - 50×50mm em A4 com margem 5/5/5/5 e gap 0 → `optionA = optionB` (etiqueta quadrada), total = 4×5 = 20.
   - 100×50mm em A4 → rotacionada cabe mais que normal.
   - Etiqueta maior que área útil → total 0.
2. **`sheetsNeeded`**: 50/20=3, 100/20=5, 0/20=0.
3. **`computeSheetPricing`**: arredondamento para R$ 0,10 (5 × 14,99 = 74,95 → 75,00); qty=0 → unit=0.
4. **`pickRoundUpsellQty`**: 50→200, 100→300, 200→500, 500→1000, 1500→ múltiplo de 500.
5. **`buildAnchoringLadder`**: dedup quando tier3 == tier2 (qty=100 → 100/200/300, não duplica); `unitDeltaPct` da última < 0.
6. **`findShrinkOpportunity`**:
   - 50×50 em A4 (gap 0, margem 5) → não há ganho (já encaixa redondo) ⇒ pode retornar null.
   - 51×51 em A4 → −1mm faz caber mais ⇒ retorna sugestão com `delta > 0`.
   - 90×90 em SRA3 → testa o caminho do −3mm.
   - Etiqueta 6×6 com −2mm cairia para 4mm → bloqueia (limite 5mm).

## Pontos confirmados

- ✅ `localStorage` para preço da folha
- ✅ Faixas de upsell 200/300/500/1000/2000
- ✅ Trava de 5mm
- ✅ Inclui −3mm no otimizador
- ✅ Margens direcionais + tipo de corte com defaults
