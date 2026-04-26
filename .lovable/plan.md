## Refatoração de nomenclatura — Histórico de Preços

Eliminar a ambiguidade dos dois pontos de acesso ao histórico, com responsividade mobile e legendas de contexto.

### 1. `src/pages/Equipamentos.tsx` — Toggle do topo (linha ~432)

Renomear para **"Compras (Global)"** com fallback mobile **"Global"**:

```tsx
<button
  type="button"
  onClick={() => setTopMode("price-history")}
  title="Visão gerencial de todas as compras e fornecedores"
  className={...}
>
  <History className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">Compras (Global)</span>
  <span className="sm:hidden">Global</span>
</button>
```

### 2. `src/pages/Equipamentos.tsx` — Aba interna do equipamento (linha ~522)

Renomear para **"Histórico desta Máquina"** com fallback mobile **"Esta Máquina"**:

```tsx
<TabsTrigger value="historico" className="gap-1.5 text-xs">
  <History className="h-3.5 w-3.5" />
  <span className="hidden sm:inline">Histórico desta Máquina</span>
  <span className="sm:hidden">Esta Máquina</span>
</TabsTrigger>
```

### 3. `src/components/equipamentos/PriceHistoryGlobalTab.tsx` — Legenda de contexto (linha ~186)

Adicionar banner sutil acima dos KPIs:

```tsx
<div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
  <History className="h-4 w-4 text-muted-foreground shrink-0" />
  <p className="text-xs text-muted-foreground leading-tight">
    <span className="font-medium text-foreground">Visão gerencial:</span> compras consolidadas de todos os equipamentos, com comparação de fornecedores e variação de preços.
  </p>
</div>
```

### 4. `src/components/equipamentos/ConsumablePriceHistoryTab.tsx` — Legenda de contexto (linha ~94)

Adicionar banner análogo, usando o `equipmentName` quando disponível:

```tsx
<div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2">
  <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
  <p className="text-xs text-muted-foreground leading-tight">
    <span className="font-medium text-foreground">Visão operacional:</span> apenas consumíveis deste equipamento{equipmentName ? ` (${equipmentName})` : ""}.
  </p>
</div>
```

### Resultado
- Topo: **Compras (Global)** / mobile: **Global** — visão gerencial.
- Aba interna: **Histórico desta Máquina** / mobile: **Esta Máquina** — visão operacional.
- Banners sutis confirmam o contexto ao entrar em cada tela.
- Sem mudanças de banco, lógica ou comportamento.