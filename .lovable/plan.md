## Diagnóstico

Pela tela enviada, a "Dica de aproveitamento" (caixa amarela) está aparecendo. O que **some** é a "Sugestões de venda" (escada de upsell), porque o gate atual em `buildAnchoringLadder` exige preço cadastrado:

```ts
// src/lib/labels/layout.ts, linha 351
if (qty <= 0 || perSheet <= 0 || pricePerSheet <= 0) return [];
```

Quando não há item de impressão cadastrado para a folha (ex.: SRA3 na sua tela), `pricePerSheet === 0` e a escada inteira vira `[]`. A vendedora perde a referência de quantidade mesmo com o cálculo de aproveitamento funcionando.

A "Dica de aproveitamento" já é independente de preço — depende só de `perSheet > 0`, então roda em todos os tipos de corte e formato. Vou confirmar isso na revisão.

## Mudanças

### 1. `src/lib/labels/layout.ts` — afrouxar gate da ladder

Trocar a linha 351 para:

```ts
if (qty <= 0 || perSheet <= 0) return [];
```

Quando `pricePerSheet === 0`, `computeSheetPricing` já devolve `totalPrice = 0` e `unitPrice = 0` naturalmente. A escada continua útil (qty + folhas necessárias).

### 2. `src/components/labels/LabelLayoutCalculator.tsx` — UI da escada sem preço

No bloco `Sugestões de venda` (linhas 1055–1098), quando `pricePerSheet <= 0`:

- Esconder a coluna `formatBRL(tier.unit)/un` e `formatBRL(tier.total)`.
- Esconder os badges de variação % (não fazem sentido sem preço base).
- Mostrar uma linha de aviso pequena no topo do card: *"Cadastre o preço da folha para ver os valores."* com link para `/preco-impressao` (já existe esse padrão de link no card "Cálculo do orçamento").
- Manter visíveis: `qty un` e `N folhas` (que é o que dá referência de salto).

Layout sem preço fica:
```
500 un      13 folhas
1.000 un    25 folhas
2.000 un    50 folhas
```

### 3. Revisão de gates (modo paramétrico, formatos, cortes)

Confirmar que tanto a "Dica de aproveitamento" quanto a "Sugestões de venda" aparecem em:

| Corte | Formato | Hardware |
|---|---|---|
| Corte reto | quadrado / retangular / personalizado | qualquer |
| Plotter quadrado | quadrado / retangular | qualquer |
| Plotter redondo | redondo | Teneth A3 (não-paramétrico) |
| Plotter redondo | redondo | SignMaster paramétrico |

A "Dica" já roda em todos esses casos (último ajuste cobriu o paramétrico). A "Sugestões de venda" passa a aparecer também quando `pricePerSheet === 0`.

## Arquivos editados

- `src/lib/labels/layout.ts` — remover `pricePerSheet <= 0` do gate de `buildAnchoringLadder`
- `src/components/labels/LabelLayoutCalculator.tsx` — render condicional da coluna de preço/badges quando `pricePerSheet <= 0`

Sem novos arquivos, sem testes adicionais (a mudança é trivial e não inventa lógica nova). Aprova?