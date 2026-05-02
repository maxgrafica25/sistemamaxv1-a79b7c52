Vou corrigir o layout para que cada linha recuada seja tratada como um container independente, sem depender das colunas originais para desenhar as etiquetas.

Plano de implementação:

1. Ajustar `computeLabelLayout` em `src/lib/labels/layout.ts`
   - Manter a regra all-or-nothing: se uma ponta da linha invade a zona de 10mm, as duas pontas da mesma linha são removidas.
   - Garantir que `cellsPerRow[row]` represente exatamente a quantidade real de etiquetas vendáveis naquela linha.
   - Recalcular `rowOffsets[row]` sempre pela fórmula informada:

```text
RowStartX = MargemEsquerda + (LarguraUtil - (QtdEtiquetasLinha * LarguraEtiqueta + (QtdEtiquetasLinha - 1) * Gap)) / 2
```

   - Aplicar isso para cada linha individualmente, inclusive linhas sem remoção, para evitar divergências entre linhas cheias e linhas recuadas.

2. Corrigir a geração das posições no PDF em `src/lib/labels/production-pdf.ts`
   - Hoje o PDF ainda itera pelas colunas originais e pula slots reservados. Isso pode deixar a linha visualmente deslocada.
   - Vou alterar para gerar somente `cellsPerRow[row]` etiquetas por linha, iniciando em `rowOffsets[row]`.
   - Assim, o PDF seguirá exatamente a mesma lógica visual do preview.

3. Confirmar o preview SVG em `src/components/labels/LabelLayoutCalculator.tsx`
   - O preview já desenha apenas `cellsPerRow[row]` a partir de `rowOffsets[row]`; vou garantir que ele continue sem hachura/texto nos slots removidos e sem usar `reservedSlots` para posicionar etiquetas.
   - O resultado esperado para o exemplo 6,1 × 5,1 cm em SRA3 será: a linha afetada mostra 3 etiquetas centralizadas, não 4 deslocadas.

4. Atualizar testes em `src/test/labels-layout.test.ts`
   - Adicionar/ajustar testes para validar:
     - nunca existe remoção unilateral em uma linha;
     - linhas recuadas usam exatamente o `RowStartX` da fórmula;
     - exemplo 61×51mm SRA3 com corte de plotter produz 3 etiquetas centralizadas na linha afetada;
     - o PDF/listagem de posições usa `cellsPerRow + rowOffsets`, e não os slots/colunas originais.

Resultado esperado:
- Preview e PDF ficam sincronizados.
- Linhas recuadas aparecem centralizadas em relação às linhas do meio.
- Não haverá mais linha com só um lado removido nem linha recuada desenhada como colunas antigas deslocadas.