## Objetivo

Duas correções nas dicas de aproveitamento:

1. **Nunca sugerir gap = 0.** O alerta "quase cabe +1 coluna" hoje pode propor `gap: 0`, o que cola as etiquetas e inviabiliza o corte. Mínimo prático = 1 mm.
2. **Garantir ganho real nas dicas de etiqueta.**
   - **Diminuir** ("cabem mais"): só sugerir se `delta ≥ 1` etiqueta extra por folha (já é o caso, mas vou reforçar a guarda explicitamente em `findShrinkOpportunity`).
   - **Aumentar** ("entregue maior"): só sugerir se a etiqueta cresce de fato em **área** mantendo `perSheet ≥ original`. Hoje já checa `areaIncreasePct > 0`, mas vou:
     - exigir `growW + growH ≥ 1 mm` (sem upgrade nominal de 0 mm),
     - garantir que o resultado final passe na regra das marcas ARMS (caso não passe, descartar).

## Mudanças técnicas

### `src/components/labels/LabelLayoutCalculator.tsx`
Em `nearMissColumn` (alerta de coluna extra via gap menor), adicionar:
```ts
if (newGap < 1) return null; // nunca colar etiquetas
```
E ajustar `Math.floor(newGap * 10) / 10` para nunca descer abaixo de 1 mm.

### `src/lib/labels/layout.ts`
- **`findShrinkOpportunity`**: já filtra por `r.best.total > originalPerSheet`. Manter, mas adicionar comentário deixando explícito que `delta ≥ 1` é obrigatório.
- **`findGrowOpportunity`**: além de `areaIncreasePct > 0`, exigir que o crescimento seja efetivo em pelo menos um lado (`c.dw + c.dh ≥ 1`) — a guarda já cobre isso pelos candidatos `[1..5]`, mas tornar explícito. O importante: já está garantido que `newPerSheet ≥ originalPerSheet`, então a sugestão sempre representa um ganho real (etiqueta maior pelo mesmo custo).

### `src/lib/labels/signmaster-spec.ts`
Mesmo reforço em `findSignmasterShrinkOpportunity` (delta > 0) e `findSignmasterGrowOpportunity` (área cresce e perSheet não cai).

## Resultado esperado

- O alerta amarelo de "reduzir gap" só aparece se o novo gap for ≥ 1 mm.
- Os cards "Cabem mais" e "Entregue maior" só aparecem quando há ganho mensurável (mais unidades OU área maior pelo mesmo número de unidades). Se nada melhora, nenhum card aparece.
