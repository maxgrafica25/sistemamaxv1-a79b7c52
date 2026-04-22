

# Adicionar rendimento real de toners (cobertura 20%) na Camada 3

## O que muda

Arquivo único: **`supabase/functions/assistente-virtual/index.ts`**, apenas na montagem das linhas de Equipamentos/Consumíveis da Camada 3 ("DADOS OPERACIONAIS"). Fórmula de preços, autenticação, Zod, CORS, Camada 1, Camada 2 e demais seções **não são tocadas**.

## Mudanças

### 1. Constantes no topo do arquivo
```ts
const COVERAGE_REFERENCE = 5;    // % — valor de fábrica cadastrado em yield_pages
const COVERAGE_OPERATIONAL = 20; // % — cobertura real da gráfica
```

### 2. Helper de classificação (whitelist por nome, sem fallback por mode)

Para evitar que "Revelador color" seja classificado como toner pelo `mode`, a detecção é **estritamente pelo nome**:

```ts
const isTonerConsumable = (c: { name: string }) => {
  const n = (c.name || "").toLowerCase();
  // Exclusões explícitas primeiro (revelador, cilindro, belt, fusor, manutenção, depreciação, ribbon)
  if (/revelador|cilindro|belt|fusor|manuten|deprecia|ribbon|fita/i.test(n)) return false;
  // Apenas o que contém "toner" é toner
  return /toner/i.test(n);
};

const realYield = (c) =>
  isTonerConsumable(c)
    ? Math.floor(Number(c.yield_pages) * (COVERAGE_REFERENCE / COVERAGE_OPERATIONAL))
    : Number(c.yield_pages);
```

Se um consumível não casar com "toner" nem com a lista de exclusão, mantém o `yield_pages` original (comportamento seguro: nunca divide por engano).

### 3. Reformatar `eqLines` na Camada 3

Para cada equipamento, listar consumíveis com nome, rendimento de fábrica (com sufixo "5%"), rendimento real a 20% somente para toners, impressões desde a última troca de toner e estimativa restante:

```
- Xerox C70 (color) | Contador atual: 123.456 | Impressões desde última troca de toner: 20
    • Toner Color: rendimento fabricante 35.000 pgs (5%) → rendimento real a 20%: 8.750 pgs
        Estimativa restante: ~8.730 pgs
    • Revelador Color: rendimento 200.000 pgs (independe de cobertura)
    • Cilindro: rendimento 150.000 pgs (independe de cobertura)
```

### 4. Não mexer em
- `getEquipmentCostPerPage` / `getEffectivePrintingCost` (a cobertura ali é da **categoria** de impressão, conceito separado)
- `calcPV`, `tiersForItem`, formato dos PREÇOS DE IMPRESSÃO
- Camada 1 (prompt) e Camada 2 (base de conhecimento)
- Queries Supabase (campos já vêm completos)

## Validação após deploy

1. *"Quantas impressões consigo fazer com 1 toner da Xerox C70?"* → **8.750 páginas** (não 35.000).
2. *"Qual o rendimento do revelador da Xerox C70?"* → mantém rendimento original (ex.: 200.000 pgs), **sem** divisão por 4.
3. *"Quanto custa Couché 210 A4 F color Xerox C70, 5 unidades?"* → continua **R$ 3,70/un, total R$ 18,50** (preços inalterados).

## Risco

Baixo. Mudança restrita à formatação textual de uma seção do prompt, com classificação estrita por nome para evitar falso-positivo em itens "color" não-toner.

