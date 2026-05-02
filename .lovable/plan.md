## Objetivo

Mostrar **duas dicas de aproveitamento** lado a lado no simulador, dando ao vendedor dois ângulos comerciais distintos:

1. **"Caber mais"** (já existe) — diminuir a etiqueta para render mais unidades por folha.
2. **"Entregar maior"** (novo) — aumentar a etiqueta sem perder unidades por folha (upgrade percebido sem custo extra).

## Layout

Quando ambas existirem, exibir em grid 2 colunas (1 coluna no mobile). Quando só uma existir, ela ocupa a largura toda. Mantém o mesmo estilo de `Alert` âmbar usado hoje, com ícones distintos:

- **Caber mais:** ícone `Minimize2` + título "Cabem mais por folha"
- **Entregar maior:** ícone `Maximize2` + título "Entregue uma etiqueta maior"

Cada card mantém botão "Aplicar sugestão" próprio.

```text
┌──────────────────────┬──────────────────────┐
│ ↘ Cabem mais/folha   │ ↗ Entregue maior     │
│ 50→47mm: +6 unid     │ 50→55mm: mesmas 30   │
│ [Aplicar]            │ [Aplicar]            │
└──────────────────────┴──────────────────────┘
```

## Mudanças técnicas

### 1. `src/lib/labels/layout.ts` — nova função `findGrowOpportunity`

Espelho do `findShrinkOpportunity`, mas:

- Testa incrementos `+1, +2, +3, +4, +5 mm` em W, H ou ambos (respeitando se a etiqueta original é quadrada — só cresce simetricamente).
- Aceita candidato apenas se `newPerSheet >= originalPerSheet` (não pode perder unidades).
- Critério de escolha: maior **área final** (W×H). Em empate, menor crescimento (preserva proporções próximas do original).
- Retorna tipo `GrowSuggestion` análogo a `ShrinkSuggestion`, com campos `newLabelW`, `newLabelH`, `growW`, `growH`, `areaIncreasePct` (ganho percentual de área), `samePerSheet: boolean`.

### 2. `src/lib/labels/signmaster-spec.ts` — `findSignmasterGrowOpportunity`

Versão equivalente para o caminho paramétrico (etiquetas redondas no SignMaster), testando aumentos no diâmetro de +1 a +5mm.

### 3. `src/components/labels/LabelLayoutCalculator.tsx`

- Calcular `grow` em paralelo a `shrink`, usando o mesmo padrão `isParametric ? signmasterGrow : layoutGrow`.
- Adicionar `applyGrow()` análogo a `applyShrink()`.
- Substituir o bloco `{shrink && <Alert>…</Alert>}` por um wrapper:
  ```tsx
  {(shrink || grow) && (
    <div className="grid gap-3 md:grid-cols-2">
      {shrink && <ShrinkSuggestionCard … />}
      {grow && <GrowSuggestionCard … />}
    </div>
  )}
  ```
- Extrair os dois cards como pequenos componentes locais para manter o JSX legível.
- O card "Entregue maior" mostra:
  > Você pode aumentar a etiqueta para **55×55mm** (+5mm em cada lado) mantendo as **30 etiquetas por folha**. Mesma quantidade, mesmo custo de produção, etiqueta **+21% maior em área**.

### 4. Testes

Em `src/test/labels-layout.test.ts`, adicionar 3 cenários para `findGrowOpportunity`:
- Caso onde existe folga (deve sugerir crescimento).
- Caso onde já está apertado (deve retornar `null`).
- Etiqueta quadrada — sugestão deve manter quadrada.

## Fora do escopo

- Não alterar a lógica do `shrink` atual.
- Não combinar as duas sugestões num único card.
- Não mostrar a dica de crescimento no PDF/WhatsApp — só na UI do simulador.
