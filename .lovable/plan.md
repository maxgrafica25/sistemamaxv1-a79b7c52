# Diferenciação visual: Insumos vs Mão de obra no Kit Encadernação

Combinar **agrupamento por seção** com **ícone discreto por linha** no `BookletKitPanel`, mantendo o visual minimalista.

## Resultado visual

```text
┌─ Kit Encadernação sugerido · espiral 7mm ─────────────────────┐
│ Use o kit sugerido, troque itens ou desmarque...              │
│                                                                │
│  INSUMOS                                                       │
│  ☑ 📦 Capa frontal     CAPA PP LINE...    1 un   R$ 2,00  Trocar│
│  ☑ 📦 Contracapa       CAPA PP CAMURCA... 1 un   R$ 2,00  Trocar│
│  ☑ 📦 Espiral 7mm      Espiral 7mm        1 un   R$ 0,00  Trocar│
│                                                                │
│  MÃO DE OBRA                                                   │
│  ☑ 🕐 Furação          Furação...         0 min  R$ 0,00      │
│  ☑ 🕐 Encadernação     Encadernação...    3 min  R$ 2,55      │
│                                                                │
│  [+ Adicionar acabamento]              [✨ Aplicar Kit]        │
└────────────────────────────────────────────────────────────────┘
```

## Mudanças

**Arquivo único:** `src/components/orcamentos-v3/forms/BookletKitPanel.tsx`

1. **Classificar `KitRow` por tipo**
   - Insumos: `capa`, `contracapa`, `espiral` (sempre que `r.unit === "un"`)
   - Mão de obra: `furacao`, `encadernacao` (sempre que `r.unit === "min"`)
   - Filtrar `rows` em dois arrays (`supplyRows`, `laborRows`) via `useMemo`.

2. **Header de seção** (entre as linhas, dentro do mesmo card)
   - `<div className="px-2 pt-2 pb-1 text-[9.5px] uppercase tracking-wider text-muted-foreground/70 font-medium">Insumos</div>`
   - Idem para "Mão de obra".
   - Renderizar a seção só se houver pelo menos 1 linha (defensivo p/ futuro).
   - Sem `border-t` — o espaçamento + tipografia já bastam pra separar.

3. **Ícone por linha em `renderRow`**
   - Adicionar imediatamente após o `<Checkbox>`, antes do `<span>` do nome:
     - Supply: `<Package className="h-3 w-3 text-muted-foreground/60 shrink-0" />`
     - Labor: `<Clock className="h-3 w-3 text-muted-foreground/60 shrink-0" />`
   - Decidido pelo `r.unit` (ou por um campo `r.kind` derivado).
   - Cor `muted-foreground/60` deixa o glifo presente mas sem competir com `primary` (módulo), `amber` (fallback) ou o badge "trocado".

4. **Acabamentos extras (`extraSlots`)**
   - Como são sempre insumos (vêm de `SupplySearch`), renderizá-los **dentro do grupo Insumos**, depois das 3 linhas fixas.
   - O botão `+ Adicionar acabamento` continua no rodapé do card (não vai pra dentro do grupo).

## Fora de escopo

- Cores extras / borda lateral / pílulas — descartado pra não competir com sinalizações existentes.
- Mexer em `bookletKit.ts`, regex de sugestão, lógica de preço, override/swap, ou outros formulários.
- Persistência ou nova prop no `apply()` — agrupamento é puramente visual.
