

# Corrigir cálculo de PV na Edge Function `assistente-virtual`

## Diagnóstico — 4 bugs encontrados

Comparei a Edge Function com `src/pages/PrecoImpressao.tsx`. Achei 4 divergências que causam o PV errado (1,50/3,80 em vez de 3,70):

### Bug 1 — `roundUp` errado (CAUSA PRINCIPAL)
- **Página real**: `roundUp5 = Math.ceil(v * 20 - 1e-9) / 20` → arredonda para cima ao próximo **R$ 0,05**.
- **Edge Function**: `roundUp10 = Math.ceil(v * 10) / 10` → arredonda ao próximo **R$ 0,10**.
- Aplicado **3 vezes** (printCost, baseCost via printCost, e PV final), o erro acumula em centavos e muda a faixa exibida.

### Bug 2 — Faltam campos no SELECT
A query de `printing_price_items` não traz **`markup_group_id`** e **`id`**. Sem `markup_group_id`, todo item cai no fallback de categoria, ignorando o grupo de markup customizado do item (a página usa `item.markup_group_id || activeGroupId`).

A query de `markup_tiers` não traz **`id`**, **`markup_group_id`** nem **`sort_order`** — deixando `tiersByGroup` sempre vazio e a ordenação errada.

### Bug 3 — Lógica de seleção de tiers diferente da página
- **Página**: `groupId = item.markup_group_id || activeGroupId` (grupo padrão da categoria) → filtra tiers por `markup_group_id === groupId`.
- **Edge**: usa categoria, não usa o `default_markup_group_id` da categoria. Resultado: pega tiers errados quando o item tem grupo customizado ou quando a categoria tem grupo padrão.

Falta também buscar `printer_categories.default_markup_group_id`.

### Bug 4 — Mistura de itens duplicados sem distinguir equipamento
A linha do prompt `Couchê 210 A4 F (color)` não inclui o nome do equipamento. Como existem 2 itens Xerox C70 Couchê 210 A4 F color (custo R$ 1,00 e R$ 1,80 de impressão), o modelo escolhe a primeira linha que aparecer e mostra preços do item errado.

## Mudanças

Arquivo único: **`supabase/functions/assistente-virtual/index.ts`**

### 1. Corrigir o arredondamento
```ts
const roundUp5 = (v: number) => Math.ceil(v * 20 - 1e-9) / 20; // R$ 0,05
```
Usar em printCost e PV final (substituindo `roundUp10`).

### 2. Completar os SELECTs
- `printing_price_items`: adicionar `id, markup_group_id`.
- `markup_tiers`: adicionar `id, markup_group_id, sort_order`.
- `printer_categories`: adicionar `default_markup_group_id`.

### 3. Replicar a lógica `getItemTiers` da página
```ts
const defaultGroupByCat = new Map<string, string | null>();
for (const c of cats) defaultGroupByCat.set(c.id, c.default_markup_group_id ?? null);

const tiersForItem = (item) => {
  const groupId = item.markup_group_id || defaultGroupByCat.get(item.printer_category_id) || null;
  return tiers
    .filter(t => t.markup_group_id === groupId)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
};
```
(Remove `tiersByCat`/fallback antigo; usa exatamente o mesmo critério da tela.)

### 4. Distinguir itens duplicados no rótulo
Incluir o **nome do equipamento** no label enviado ao modelo:
```
- Couchê 210 A4 F (color) [Xerox C70]:
    TP1 (1-20 un) → R$ 3,70/un | TP2 ... | TP3 ... | TP4 ...
```
Para isso, pré-carregar mapa `equipmentNameById` e usá-lo na construção de `label`.

### 5. Reforçar prompt para considerar equipamento
Atualizar a "REGRA CRÍTICA — PREÇO DE VENDA" para incluir: *"Se houver mais de um item com mesmo papel/gramatura/tamanho/lado/modo (impressoras diferentes), peça ao usuário qual equipamento antes de responder, ou liste todos."*

## Validação

1. *"Couchê 210 A4 F color, Xerox C70 (custo impressão 1,80), 5 unidades"* → deve responder **R$ 3,70/un, total R$ 18,50** (igual à tela).
2. *"Couchê 210 A4 F color, 5 unidades"* (ambíguo) → deve perguntar qual equipamento ou listar os dois.
3. Item com grupo de markup customizado → deve usar o grupo do item, não o padrão da categoria.
4. Item sem grupo customizado em categoria com `default_markup_group_id` → usa o grupo padrão.

## Risco

Baixo. Mudança contida em 1 arquivo, replicando exatamente a função da página. Sem alteração de banco/UI/auth.

