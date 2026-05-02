# Faixas de preço por quantidade + Preditor de Prazo Real (PPR)

## Visão geral

Três frentes coordenadas, todas plugadas na **Calculadora de Etiquetas**:

1. **Faixas de preço de acabamento** por quantidade de folhas (espelha markup_tiers da impressão).
2. **Preditor de Prazo Real (PPR)**: estima metragem linear de corte e tempo de plotter.
3. **Reforço da simetria ARMS** (regra all-or-nothing) já aplicada hoje, formalizada e protegida por testes.

Os módulos **Preço Impressão** e **Acabamentos** continuam separados — composição em runtime no hook `useFolhaPricing`.

---

## 1. Faixas de preço para Acabamentos

### 1.1 Banco — nova tabela `finishing_price_tiers`

```sql
create table finishing_price_tiers (
  id uuid pk default gen_random_uuid(),
  finishing_id uuid not null references finishings_price_items(id) on delete cascade,
  label text not null,                  -- "1-10", "11-50", "51+"
  min_qty integer not null,             -- em FOLHAS
  max_qty integer null,                 -- null = sem teto
  price_per_sheet numeric not null,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- RLS: SELECT authenticated; INSERT/UPDATE/DELETE admin (mesmo padrão de finishings_price_items).
-- Trigger de validação: min_qty ≥ 1; max_qty IS NULL OU max_qty ≥ min_qty;
--                       sem sobreposição entre tiers do mesmo finishing_id.
-- Seed: para cada finishing existente, cria 1 tier {min:1, max:null, price=price_per_sheet atual}.
```

`finishings_price_items.price_per_sheet` permanece como **fallback** quando o acabamento não tem nenhuma tier cadastrada — zero regressão.

### 1.2 UI — `/acabamentos`

Nova coluna "Faixas" com botão `Settings2` que abre um **Drawer lateral** (já temos `sheet.tsx`):

```text
┌── Recorte plotter · SRA3 ──────────────────────┐
│ Preço base: R$ 1,80/folha                      │
│                                                │
│ Faixas por quantidade (folhas)                 │
│ ┌────────┬──────┬──────┬───────────┬───┐       │
│ │ Faixa  │ Min  │ Máx  │ R$/folha  │ × │       │
│ ├────────┼──────┼──────┼───────────┼───┤       │
│ │ 1-10   │  1   │  10  │   1,80    │ × │       │
│ │ 11-50  │  11  │  50  │   1,40    │ × │       │
│ │ 51+    │  51  │  ∞   │   1,00    │ × │       │
│ └────────┴──────┴──────┴───────────┴───┘       │
│ [+ Adicionar faixa]                            │
└────────────────────────────────────────────────┘
```

Validação client-side: faixas contínuas, sem buracos nem sobreposição, max ≥ min, preço > 0.

### 1.3 Lógica

Novo módulo `src/lib/labels/finishing-pricing.ts`:

```ts
pickFinishingTier(tiers: FinishingTier[], sheetsQty: number): number
// Retorna price_per_sheet da tier onde min ≤ sheetsQty ≤ (max ?? ∞).
// Se tiers vazio, o caller usa o fallback de finishings_price_items.
```

`useFolhaPricing(size, sheetsQty?)` ganha o segundo parâmetro:
- carrega `finishing_price_tiers` junto com `finishings_price_items`;
- quando `sheetsQty` informado e há tiers → usa `pickFinishingTier`;
- caso contrário → preço base (comportamento atual).

`LabelLayoutCalculator` já calcula `sheetsNeeded` → passa ao hook. Preço se atualiza ao mudar quantidade.

---

## 2. Preditor de Prazo Real (PPR)

### 2.1 Módulo de cálculo — `src/lib/labels/production-time.ts`

```ts
export interface ProductionTimeInput {
  shape: "quadrado" | "retangulo" | "redondo" | "personalizado";
  labelW: number;        // mm
  labelH: number;        // mm
  totalLabels: number;
  sheets: number;
  hardwareId: string;    // para selecionar perfil
}

// Perímetro por etiqueta (mm)
function perimeterMm({ shape, labelW, labelH }) {
  switch (shape) {
    case "redondo":       return Math.PI * labelW;          // diâmetro = labelW
    case "personalizado": return 2 * (labelW + labelH) * 1.20; // bbox + 20%
    default:              return 2 * (labelW + labelH);
  }
}

// Constantes Teneth A3 (em hardware.ts)
//   bladeSpeedMmPerSec: 300
//   sheetSetupSec:       15   (troca + leitura ARMS)
// Outros perfis caem num default genérico (250 mm/s, 10s) ou null = "sem PPR".

export function estimateProductionTime(i): {
  totalPerimeterM: number;     // metros lineares totais
  cuttingSec: number;
  setupSec: number;
  totalSec: number;
  loadBadge: "pronta-entrega" | "padrao" | "intensa";
}
// totalSec = (perimeter * totalLabels / speed) + (sheets * setupSec)
// loadBadge: <15min → "pronta-entrega", 15min..1h → "padrao", >1h → "intensa"
```

### 2.2 Constantes em `hardware.ts`

```ts
HardwareProfile {
  ...,
  bladeSpeedMmPerSec?: number;   // null = não calcular PPR
  sheetSetupSec?: number;
  customComplexityFactor?: number; // default 1.20 para "personalizado"
}
// teneth_a3:        { bladeSpeedMmPerSec: 300, sheetSetupSec: 15 }
// signmaster_param: { bladeSpeedMmPerSec: 300, sheetSetupSec: 12 } // sem tração mas com setup manual
// generico:         sem PPR
```

### 2.3 UI — card "Produção" no painel lateral

Abaixo do bloco de preço atual, antes do botão WhatsApp:

```text
┌── Produção (Teneth A3) ─────────────────┐
│  Metragem linear:   38,4 m              │
│  Tempo de plotter:  ~12 min             │
│  [● Pronta entrega]                     │
│                                         │
│  Lâmina percorrerá o equivalente a      │
│  uma quadra de 10 m.                    │
└─────────────────────────────────────────┘
```

Badge:
- `pronta-entrega` (verde) se total ≤ 15 min
- `padrao` (azul) se 15 min < total ≤ 60 min
- `intensa` (âmbar) se > 60 min

Texto e número saem direto de `estimateProductionTime`. Se o hardware atual não tiver constantes, o card **não aparece** (comportamento opcional, sem ruído).

---

## 3. Reforço de Simetria ARMS (formalização)

A regra "all-or-nothing" já existe em `layout.ts` (linhas 227–235) e em `signmaster-spec.ts` (linha 99). Esta entrega:

- Documenta a invariante num comentário-chefe sobre `computeLabelLayout`:
  > Se uma das pontas da linha invade os 10 mm de zona de segurança ARMS, **as duas pontas** são removidas e a linha é centralizada via `RowStartX`. Nunca remover só uma ponta — quebra simetria visual.

- Garante via teste o caso-âncora **50×50 mm em SRA3 (paramétrico)** → **42 etiquetas** (6 col × 7 lin), sem remoção de ponta — os "braços" do L ficam externos.

- Sem mudança de algoritmo. É uma "trava" via teste para evitar regressão futura.

---

## 4. Arquivos afetados

### Novos
- migração SQL: `finishing_price_tiers` + RLS + trigger anti-overlap + seed.
- `src/lib/labels/finishing-pricing.ts` — `pickFinishingTier` + tipos.
- `src/lib/labels/production-time.ts` — `estimateProductionTime` + tipos + badge.
- `src/components/acabamentos/FinishingTiersDrawer.tsx` — editor de faixas.
- `src/components/labels/ProductionTimeCard.tsx` — card "Produção".
- `src/test/finishing-pricing.test.ts` — pickTier (faixa exata, limites, fallback).
- `src/test/production-time.test.ts` — quadrado, redondo, personalizado, badges.
- `src/test/labels-symmetry.test.ts` — âncora 50×50 SRA3 → 42 etiquetas.

### Editados
- `src/pages/Acabamentos.tsx` — coluna "Faixas" + abre drawer.
- `src/lib/labels/sheet-pricing.ts` — `useFolhaPricing(size, sheetsQty?)`.
- `src/lib/labels/hardware.ts` — `bladeSpeedMmPerSec`, `sheetSetupSec` por perfil.
- `src/components/labels/LabelLayoutCalculator.tsx` — passa `sheetsNeeded` ao hook + monta `<ProductionTimeCard/>`.
- `src/lib/labels/layout.ts` — comentário formalizando a regra de simetria (sem mudança de lógica).

---

## 5. Fora do escopo

- Não fundir Preço Impressão + Acabamentos (continuam módulos separados).
- Não recalcular markup_tiers da impressão.
- Não criar combos persistidos (impressão+acabamento) — composição é runtime.
- PPR não considera variações de complexidade interna do desenho personalizado além do fator 1,20 sobre o bbox. Refinamentos baseados em SVG real ficam para uma v2.

---

## Resultado prático

- **Atacado**: 5.000 etiquetas → folhas necessárias caem na faixa "51+", recorte vai automaticamente para R$ 1,00/folha.
- **Promessa de entrega**: cada orçamento mostra "~12 min de plotter, pronta entrega" — sem chute.
- **Gestão de lâmina**: metragem linear acumulável a partir do PPR de cada serviço (base para um futuro alerta de troca de ponta).
