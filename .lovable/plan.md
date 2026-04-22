

# Replicar `getEquipmentCostPerPage` na Edge Function

## Diagnóstico — 2 bugs reais

### Bug A (CAUSA PRINCIPAL): custo de impressão errado para itens com equipamento
A página `PrecoImpressao.tsx` (linha 237-240) usa:
```ts
const getEffectivePrintingCost = (item) => {
  if (item.equipment_id) return getEquipmentCostPerPage(item.equipment_id, coveragePct, item.equipment_mode === 'pb');
  return item.printing_cost;
};
```

Quando o item tem `equipment_id` (ex.: Xerox C70), o custo NÃO é o `printing_cost` cadastrado na linha — é calculado dinamicamente a partir dos **consumíveis do equipamento** (toner/drum) usando a **cobertura da categoria** (20% para color, 5% para PB).

A Edge Function ignora isso e usa `item.printing_cost` direto. Resultado: PV diferente do mostrado na tela (R$ 3,80 vs R$ 3,70 = diferença de R$ 0,10 que sobe a faixa).

### Bug B: arredondamento do PV final
- **Página** (linha 87): `Math.round((baseCost / divisor) * 10) / 10` → arredonda para o **mais próximo** de R$ 0,10 (pode ser para baixo).
- **Edge Function** (linha 242): `roundUp5(baseCost / divisor)` → sempre para cima ao próximo R$ 0,05.

Diferença sistemática nos centavos.

## Mudanças

**Arquivo único: `supabase/functions/assistente-virtual/index.ts`**

### 1. Replicar `getEquipmentCostPerPage`
Buscar o código exato da função em `PrecoImpressao.tsx` e portar para a Edge Function. Ela calcula:
```
custoPorPagina = Σ (consumivel.price / consumivel.yield_pages) × (cobertura/100 ou 1, conforme o modo)
```
- Cobertura color = 20%, PB = 5% (definida pela categoria via `getCategoryCoverage`).
- Filtra consumíveis pelo modo (`color`/`pb`/`shared`) e respeita `forcePB` quando `item.equipment_mode === 'pb'`.

### 2. Atualizar `calcPV` na Edge Function
Trocar `Number(item.printing_cost || 0)` por `getEffectivePrintingCost(item, category)`:
```ts
const getEffectivePrintingCost = (item, catName) => {
  if (item.equipment_id) {
    const coverage = /color/i.test(catName) ? 20 : 5;
    return getEquipmentCostPerPage(item.equipment_id, coverage, item.equipment_mode === 'pb');
  }
  return Number(item.printing_cost || 0);
};
```

### 3. Trocar arredondamento do PV final
De `roundUp5` para `Math.round(v * 10) / 10` (igual à linha 87 da página).
Manter `roundUp5` no `printCost` (igual à linha 996 da página).

### 4. Buscar dados extras necessários
A query `equipment_consumables` já existe; só falta garantir que vem `mode`, `price`, `yield_pages`, `equipment_id` (já vem). E a query `printer_categories` já traz `name` (necessário para detectar color/PB).

## Validação

1. *"Couchê 210 A4 F color, Xerox C70, 5 un"* → R$ 3,70/un (TP1), total R$ 18,50.
2. *"Couchê 210 A4 F color, Xerox C70, 1500 un"* → R$ 2,70/un (TP4), total R$ 4.050,00.
3. Item sem `equipment_id` (custo manual) → usa `printing_cost` cadastrado, mesmo PV da tela.

## Risco

Baixo. Mudança em 1 arquivo, replicando função existente da página. Sem alteração de banco/UI/auth.

