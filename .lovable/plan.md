# Plano — Filtros + Kits CV + Padrão UX

## Parte 1 — Filtros visuais em Matérias-Primas

**Arquivo:** `src/pages/MateriasPrimas.tsx`

- 3 chips no header: `Todos · Gráfica · CV` (com contador `Gráfica · 42`)
- Estado `moduloFiltro`, default `todos`; filtra por `modulo @> {grafica|cv}`
- `Badge` outline/secondary, primary quando ativo

## Parte 2 — Kits em Grupos de Materiais

`material_groups` já guarda insumos com `supply_id`. Estender para suportar mão de obra e cobrança por dimensão (replica planilha Excel: Banner Bastão Topo = bastão x2 + ponteira x4 + cordinha por m + 10 min MO).

### 2.1 Schema (migration)

`material_groups` — novas colunas (defaults seguros):
- `is_kit boolean default false`
- `modulo text[] default '{grafica}'` (mesmo padrão dos supplies)
- `pricing_mode text default 'fixo'` — `fixo | mt2 | perimetro | unidade`
- `labor_minutes numeric default 0`
- `labor_hour_rate_source text default 'despesas_fixas'` — `despesas_fixas | manual`
- `labor_hour_rate_manual numeric default 0`
- `margin_pct numeric` (null = usa global)
- `notes text`

`material_group_items`:
- `consumo_tipo text default 'fixo'` — `fixo | por_m2 | por_perimetro_m | por_unidade`

### 2.2 UI em `GruposMateriais.tsx`

Dialog com novo bloco "Kit calculável" (toggle `is_kit`):
- Modo de cobrança, Tempo MO (min), Origem hora (Despesas Fixas/Manual)
- Checkbox "Visível em" (Gráfica/CV)
- Por item: select **Escala** (Fixo / por m² / por metro de perímetro / por unidade)
- **Sugestão inteligente de consumo_tipo:** ao escolher um supply, sugere a escala mais provável a partir do nome (heurística: "bastão|barra|perfil" → por_largura/perimetro, "cordinha|fita" → por_perimetro_m, "ponteira|olhal|ilhós" → por_unidade, demais → fixo). Aplica como default mas sempre editável.

#### 2.2.1 Preview financeiro ao vivo (UX prioritária)

Painel sticky na lateral do dialog de edição do kit (mesmo padrão "config no meio + resumo direita" da Parte 3):
- Inputs de exemplo: `Largura × Altura × Qtd` (default 100×100×1)
- Recalcula em tempo real conforme o usuário edita itens, MO ou margem
- Mostra: Custo Material · Custo MO · Subtotal Custo · Impostos+Taxas · Margem · **Preço Venda** · **Lucro Líquido (R$ · %)**
- Breakdown linha-a-linha por item do kit (qtd efetiva × preço unit)
- Usa exatamente a mesma engine da Parte 2.3 (garante paridade com a calculadora)

### 2.3 Engine `src/lib/kitPricing.ts`

```ts
calcKitPrice(kit, { largura_cm, altura_cm, quantidade }, { hourRate, globalSettings })
→ { custoMaterial, custoMO, custoTotal, lucroLiquido, precoVenda, breakdown[] }
```
- `custoMaterial` = Σ `item.quantity × unit_price × escala(dim)`
- `custoMO` = `(labor_minutes/60) × hourRate`
- `precoVenda` = `custoTotal / (1 - (taxes+fees+margin)/100)`, arredondado p/ cima R$ 0,10

### 2.4 Consumo na Calculadora CV

`AcabamentosTab.tsx` + `CalculadoraTab.tsx`:
- Picker de acabamento ganha seção "Kits" (lista `material_groups` com `is_kit=true` e `cv` no módulo)
- Selecionar kit injeta resultado de `calcKitPrice`; breakdown salvo em `finishes_json` como `{ kit_id, custo_material, custo_mo, lucro }`

## Parte 3 — Padrão UX "config no meio + resumo direita"

`src/components/shared/CalcShell.tsx`:
```
Header
Grid 2col (gap-6):
  [ Configuração (col-span-2) ] [ Resumo Financeiro (sticky) ]
```

Props: `{ title, icon, actions, children, summary, steps? }`.
**`steps?`** slot opcional para stepper (preparado para futuras calculadoras multi-step, mesmo que não usado agora).

`FinancialSummary` reutilizável: linhas Custo/Lucro com `text-destructive`/`text-success`, espelha padrão do Orçamento V2. Reaproveitado também pelo preview do kit (2.2.1).

### Ordem de migração:
1. Calculadora CV (`CalculadoraTab.tsx`) — mostrar breakdown Material+MO+Lucro do kit
2. Calc Etiquetas (`CalculadoraEtiquetas.tsx`)
3. Preço Impressão (`PrecoImpressao.tsx`)
4. Orçamento V2 — referência, não muda

## Ordem de execução

1. Chips em Matérias-Primas (Parte 1)
2. Migration kits (2.1)
3. Engine `kitPricing.ts` (2.3) — primeiro, pois alimenta o preview
4. `CalcShell` + `FinancialSummary` (Parte 3 base)
5. UI de kits em Grupos com preview ao vivo + sugestão de escala (2.2)
6. Calculadora CV consumindo kits + novo shell (2.4 + 3.1)
7. Migrar Calc Etiquetas e Preço Impressão

## Diferido (anotado para iteração futura)

- **Histórico de versões dos kits**: tabela `material_group_versions` para snapshot da receita em cada mudança, permitindo auditar custo de pedidos antigos. Fora do escopo atual.
- **Views materializadas por módulo**: só se o índice GIN virar gargalo real.

## Detalhes técnicos

- `useHourRate()`: hook que lê `despesas_fixas` e divide pelas horas produtivas/mês (reaproveitar lógica existente; criar se faltar)
- Markup/arredondamento: utilitários já existentes
- Sem mudanças destrutivas — toda coluna nova tem default; grupos existentes continuam funcionando (kit=false)
