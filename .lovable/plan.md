## Refatoração visual — Calculadora de Etiquetas

Mantém 100% da lógica (cálculos, pricing, ladder, PDF, .plt, presets, configs). Apenas estrutura, espaçamento e hierarquia visual.

### Arquivos modificados

**1. `src/pages/CalculadoraEtiquetas.tsx`**
Trocar wrapper por:
```tsx
<div className="mx-auto max-w-[1440px] px-4 md:px-6 lg:px-8 py-6 space-y-6">
```
Header (ícone + título + subtítulo) preservado.

**2. `src/components/labels/LabelLayoutCalculator.tsx`**

**Grid raiz (linha 645)** — trocar para layout 70/30 com sticky:
```tsx
<div className="grid gap-6 lg:grid-cols-10">
  <div className="lg:col-span-7 space-y-5">…inputs…</div>
  <div className="lg:col-span-3 space-y-5 lg:sticky lg:top-6 lg:self-start lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">…resultados…</div>
</div>
```

**Padronização de Cards** — aplicar em todos os Cards principais (Folha, Simulador, Aproveitamento, Cálculo do orçamento, Sugestões de venda):
```
className="rounded-xl border-border/60 shadow-sm bg-card p-5 md:p-6 space-y-4"
```
Faixa-resumo (botão Configurações no topo) também `rounded-xl` com `bg-muted/40 hover:bg-muted/70`.

**Card de Aproveitamento (linha 932)** — nova hierarquia visual:
```text
┌──────────────────────────────────┐
│  ◐ 75%        120                │
│  donut    etiquetas/folha (4xl)  │
├──────────────────────────────────┤
│  ┌── bg-muted/30 rounded-lg ──┐ │
│  │     [SheetPreview SVG]      │ │
│  └─────────────────────────────┘ │
├──────────────────────────────────┤
│ chips: 6×20 · rotacionada · …    │
└──────────────────────────────────┘
```
- Donut SVG 72×72 (`<svg viewBox="0 0 36 36">` com dois `<circle>` usando `stroke-dasharray` proporcional a `utilizationPct`). Trilho `stroke-muted`, progresso `stroke-primary`.
- "Etiquetas por folha": número em `text-4xl font-bold text-primary`, label em `text-xs text-muted-foreground`.
- `SheetPreview` envolto em `<div className="bg-muted/30 rounded-lg p-3">`.
- Badges de detalhes (cols×rows, rotacionada, margens, área útil, perfil hardware) movidas para o final em `flex flex-wrap gap-1.5 text-[11px]`.

**Card "Cálculo do orçamento" (linha 1148)** — hierarquia de CTAs:
- Bloco do preço total (linhas 1257–1281) ganha caixa interna:
  ```tsx
  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
    <p className="text-3xl font-bold text-primary">{formatBRL(pricing.totalPrice)}</p>
    <p className="text-xs text-muted-foreground">unitário {formatBRL(pricing.unitPrice)}</p>
  </div>
  ```
- Botões (linhas 1295–1340): trocar `grid grid-cols-2` por `flex flex-col gap-2` com separador `border-t pt-3`.
  1. **Copiar WhatsApp** — `variant="default" size="lg" className="w-full"` (roxo sólido, CTA principal).
  2. **Abrir WhatsApp** — `variant="outline" className="w-full"`.
  3. **Gerar PDF de produção** — `variant="outline" className="w-full"`.
  4. **.plt SignMaster** (paramétrico) e **Usar X folhas** (onApply) seguem abaixo, full-width outline.

**Refinamento de UI**:
- Toggle groups (formato, folha, tipo adesivo/papel): trocar `h-9`/`h-8` por `h-10`.
- `space-y-1.5` em campos de input → `space-y-2`.
- Espaçamento entre cards: `space-y-4` → `space-y-5` em ambas as colunas.

### Fora do escopo (não muda)
- Lógica de cálculo (`layout.ts`, `sheet-pricing.ts`, `whatsapp.ts`, `marks.ts`, `signmaster-spec.ts`, etc.).
- `LabelCalcSettingsDialog`, `LabelLayoutDialog`, `ProductionTimeCard`.
- Componente interno `SheetPreview` (apenas o container muda).
- Card "Sugestões de venda" — só recebe novo padding/rounded, sem reestruturação.
- Paleta, tokens em `index.css`, `tailwind.config.ts`.
- Tipos, persistência, hooks, RLS.
