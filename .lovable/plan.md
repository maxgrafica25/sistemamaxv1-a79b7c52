# Correção da regra ARMS na 1ª linha — garantir monotonicidade do rendimento

## Problema

A regra atual só remove etiquetas da 1ª linha quando a folga lateral é < 10mm. Isso quebra a monotonicidade: Ø3,8cm rende 70 enquanto Ø3,5cm (menor) rende apenas 87 e Ø4,0cm (maior) rende 69. Etiquetas que "se ajeitam" em zonas de folga grande escapam da penalidade e ficam matematicamente inconsistentes.

## Solução

Para qualquer formato com marcas ARMS (redondo + quadrado plotter), aplicar:

> **Quando a folha tem 2+ linhas, a 1ª linha sempre tem ao menos 1 etiqueta a menos do que a capacidade bruta, OU é reduzida até atingir ≥10mm de folga — o que for mais restritivo.**

Resultado validado matematicamente (SRA3 320×450, gap 3mm):

| Ø     | Bruto | Antes | Depois |
|-------|-------|-------|--------|
| 3,5cm | 8×10  | 87    | 87     |
| 3,8cm | 7×10  | 70    | **69** |
| 4,0cm | 7×9   | 69    | 69     |
| 5,0cm | 5×8   | 40    | **39** |

Curva monotônica garantida: tamanho ↑ ⇒ rendimento ↓ (ou igual). Perda máxima de 1 etiqueta por folha em troca da segurança da marca ARMS.

## Arquivos a editar

### 1. `src/lib/labels/signmaster-spec.ts`

Em `safeCellsForTopRow` (linhas 99-108):
- Calcular `nByGap` pela regra atual de slack ≥ 10mm
- Quando `labelsPerColumn ≥ 2`, retornar `min(nByGap, labelsPerRow − 1)`
- Quando `labelsPerColumn < 2`, manter apenas a regra de slack (não faz sentido remover na única linha)

### 2. `src/lib/labels/layout.ts`

Em `computeReservedSlots` (linhas 199-234):
- Após `topSafe = safeCellsForRow(cols)`, aplicar: se `rows ≥ 2` e `cutType !== "corte_reto"`, então `topSafe = min(topSafe, cols − 1)`
- Mesmo tratamento para `bottomSafe` (já existente para não-redondo) por simetria visual
- `corte_reto` permanece intocado — não tem ARMS

### 3. `src/test/signmaster-spec.test.ts`

Atualizar/adicionar fixtures:
- Ø3,5cm SRA3 gap 3mm → 87 (mantém)
- Ø3,8cm SRA3 gap 3mm → **69** (era 70)
- Ø4,0cm SRA3 gap 3mm → 69 (mantém)
- Ø5,0cm 320×450 → **39** (era 40 na referência histórica da spec)

Adicionar comentário no topo do arquivo documentando que a regra ARMS é prioritária sobre a fórmula original da spec SignMaster.

## Fora do escopo

- `corte_reto` (sem marca ARMS, sem necessidade)
- Aviso "near miss column" recém-adicionado (continua funcionando)
- Preview SVG (a centralização por linha já lida automaticamente com cellsPerRow)
