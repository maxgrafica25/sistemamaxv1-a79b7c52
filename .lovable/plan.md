## Objetivo

Reorganizar a "Calculadora de Etiquetas" em **3 colunas no desktop largo (xl)**, eliminar a barra de rolagem interna da sidebar, remover o gráfico donut do card de Aproveitamento e dar mais respiro ao SheetPreview. Toda a lógica de cálculo, pricing, PDF, .plt e WhatsApp permanece **inalterada**.

## Arquivos a editar

1. `src/pages/CalculadoraEtiquetas.tsx`
2. `src/components/labels/LabelLayoutCalculator.tsx`

## Mudanças

### 1. Container da página (`CalculadoraEtiquetas.tsx`)

Trocar o wrapper:

```text
mx-auto max-w-[1440px] px-4 md:px-6 lg:px-8 py-6 space-y-6
        ↓
mx-auto w-full max-w-[1600px] px-4 md:px-6 xl:px-8 py-6 space-y-6
```

### 2. Grid raiz (`LabelLayoutCalculator.tsx`, linha 645)

```text
grid gap-6 lg:grid-cols-10
        ↓
grid gap-6 grid-cols-1 lg:grid-cols-2 xl:grid-cols-12
```

### 3. Distribuição em 3 colunas

**Coluna 1 — Esquerda (`xl:col-span-4`)**
- Faixa-resumo das configurações (botão).
- Card "Folha" (seleção rápida).
- Card "Simulador" (que internamente já contém os blocos Formato e Arte da etiqueta — mantemos como um card unificado para não mexer na lógica interna).

Wrapper atual `lg:col-span-7 space-y-5` → `xl:col-span-4 space-y-5`.

**Coluna 2 — Centro (`xl:col-span-5`)**
Novo wrapper `xl:col-span-5 space-y-5` contendo:
- Card "Aproveitamento" (com `SheetPreview` em destaque) — movido da sidebar atual.
- Alertas "near-miss" e Otimizadores (Cabem mais / Etiqueta maior) — mantidos junto do Aproveitamento por contexto.
- Card "Sugestões de venda" — movido para o final desta coluna (sai da direita).

**Coluna 3 — Direita (`xl:col-span-3 xl:sticky xl:top-6 xl:self-start`)**
- Apenas o card "Cálculo do orçamento" (incluindo `ProductionTimeCard`, CTAs e botão .plt do SignMaster).
- **Sem** classes `lg:max-h-[calc(100vh-3rem)]` nem `lg:overflow-y-auto`.

### 4. Card de Aproveitamento — limpeza visual

No bloco atual (linhas ~932–1053):

- **Remover o donut SVG inteiro** (todo o IIFE com `<svg viewBox="0 0 36 36">` e os dois `<circle>`, linhas ~935–963).
- Substituir por um cabeçalho limpo: aproveitamento em texto (`text-2xl font-semibold tabular-nums`) à esquerda + "Etiquetas por folha" à direita com `text-4xl font-bold text-primary` (mantido).
- **Remover** o wrapper `bg-muted/30 rounded-lg p-3` ao redor do `SheetPreview` para deixá-lo respirar e ocupar toda a largura da coluna central.
- Manter os badges técnicos (cols × rows, rotação, zona segura, área útil, margens/gap) e o slider de offset das marcas.

Esquema do novo header do card:

```text
┌──────────────────────────────────────────┐
│ Aproveitamento 75%        420            │
│                          etiquetas/folha │
├──────────────────────────────────────────┤
│                                          │
│        [ SheetPreview grande ]           │
│                                          │
├──────────────────────────────────────────┤
│ [3×4] [Em pé] área útil … ⚙ 5/5/5/5 …    │
└──────────────────────────────────────────┘
```

### 5. CTAs (Coluna 3)

Mantidos exatamente como hoje (já atendem ao pedido):
- "Copiar WhatsApp" — `variant="default" size="lg" w-full` (destaque máximo).
- "Abrir WhatsApp" — `variant="outline" w-full`.
- "Gerar PDF de produção" — `variant="outline" w-full`.
- "Baixar faca .plt" e "Usar X folhas" permanecem condicionais.

### 6. Reordenamento dentro do JSX

A sidebar atual (linhas 930–1505) será dividida em dois wrappers:

```text
<div xl:col-span-5> ... Aproveitamento + alertas + Sugestões de venda ... </div>
<aside xl:col-span-3 xl:sticky xl:top-6 xl:self-start> ... Cálculo do orçamento ... </aside>
```

## Comportamento responsivo

- `< lg` (mobile/tablet): coluna única (`grid-cols-1`), tudo empilhado na ordem do JSX (Esquerda → Centro → Direita).
- `lg` a `< xl`: 2 colunas (`lg:grid-cols-2`) — Esquerda fica em uma coluna; Centro e Direita na outra (empilhados via fluxo natural).
- `xl+`: 3 colunas 4/5/3 com a Direita sticky.

## Garantias

- Nenhuma alteração em `src/lib/labels/*` ou em `useFolhaPricing`/`computeLabelLayout`/`computeSheetPricing`.
- Nenhum prop novo nos componentes filhos (`SheetPreview`, `ProductionTimeCard`, `LabelCalcSettingsDialog`).
- Nenhuma classe `overflow-y-auto` ou `max-h-[calc(...)]` nas colunas do grid raiz.
