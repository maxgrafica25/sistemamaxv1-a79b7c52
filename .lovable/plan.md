## Problema

A dica amarela "Reduzindo a etiqueta para X×Ymm cabem +N etiquetas por folha" sumiu para etiquetas redondas. Hoje o cálculo de oportunidade (`findShrinkOpportunity`) está bloqueado quando o modo SignMaster paramétrico está ativo:

```ts
const shrink = !isParametric && perSheet > 0 ? findShrinkOpportunity(...) : null;
```

Como o modo paramétrico passou a ser o default, a vendedora deixou de ver a sugestão — exatamente onde ela mais agrega (etiquetas redondas em SRA3).

## Solução

Calcular a sugestão usando a fórmula correta para cada modo, sem mexer na UI (o card amarelo já existe e renderiza igual).

### 1. Nova função `findSignmasterShrinkOpportunity` em `src/lib/labels/signmaster-spec.ts`

Espelha `findShrinkOpportunity`, mas usa `computeSignmasterLayout` para avaliar cada candidato. Como aqui só faz sentido reduzir o diâmetro (W = H sempre), os candidatos passam a ser:

- −1 mm, −2 mm, −3 mm no diâmetro (incluindo passos de 0,5 mm: −0,5 / −1,5 / −2,5 mm para granularidade fina, já que o usuário trabalha em cm com step 0,1).

Critério de seleção idêntico ao genérico: maior `delta` (mais etiquetas/folha); empate → menor encolhimento. Trava de segurança: diâmetro mínimo 5 mm.

Retorna o mesmo formato `ShrinkSuggestion` (`newLabelW`, `newLabelH` iguais ao novo diâmetro, `shrinkW === shrinkH === reduçãoMm`, `delta`, `extraUnitsForSameSheets`).

### 2. Integrar em `LabelLayoutCalculator.tsx`

Trocar a linha 386–388 por:

```ts
const shrink = perSheet > 0
  ? (isParametric
      ? findSignmasterShrinkOpportunity({ sheetW: config.sheetW, sheetH: config.sheetH, labelDiameter: labelW }, perSheet, pricing.sheetsNeeded || 1)
      : findShrinkOpportunity(layoutInput, perSheet, pricing.sheetsNeeded || 1))
  : null;
```

A função `applyShrink` já cobre o caso redondo (mantém shape "redondo" porque W === H).

### 3. Teste

Adicionar caso em `src/test/signmaster-spec.test.ts`:

- SRA3 320×450 + Ø 50 mm → 40 etiquetas. Reduzindo para Ø 49 mm (ou 48), espera-se ganho ≥ 8 etiquetas (próxima coluna entra). Validar que `findSignmasterShrinkOpportunity` retorna sugestão não-nula com `delta > 0`.

## Arquivos

- editar `src/lib/labels/signmaster-spec.ts` — adicionar `findSignmasterShrinkOpportunity`
- editar `src/components/labels/LabelLayoutCalculator.tsx` — usar a nova função no modo paramétrico (linhas 386–388 e import)
- editar `src/test/signmaster-spec.test.ts` — cobertura da nova função

Sem mudanças visuais; o card amarelo "Dica de aproveitamento" volta a aparecer automaticamente. Aprova?