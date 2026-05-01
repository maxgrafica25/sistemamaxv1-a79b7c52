## Diagnóstico

A matemática está correta — reduzindo a largura para 48mm realmente cabem +8 etiquetas (6×8 = 48 vs. 5×8 = 40 originais). O problema é **conceitual / UX**:

1. A etiqueta atual é **quadrada** (50×50mm).
2. O algoritmo sugeriu **48×50mm** — vira retangular para ganhar 8 unidades.
3. Para o cliente, "etiqueta 5×5" virar "4,8×5" muda o produto. A vendedora não vai querer oferecer isso.

Validei no terminal: a alternativa **48×48mm** (manter quadrado, encolhendo igual nos dois lados) também dá +8 etiquetas. Então a sugestão correta para etiqueta quadrada seria essa.

A causa raiz: `findShrinkOpportunity` testa `{2,0}, {0,2}, {2,2}` e em empate de delta prefere o de **menor encolhimento total** (`dw+dh`). Como {2,0} soma 2 e {2,2} soma 4, ele escolhe o retangular.

## Mudança

### `src/lib/labels/layout.ts` — preservar formato da etiqueta no shrink

Em `findShrinkOpportunity`, quando a etiqueta original é quadrada (`labelW === labelH`), **só considerar candidatos simétricos** (`dw === dh`). Isso garante que a sugestão preserva o formato:

```ts
const isSquare = base.labelW === base.labelH;
const candidates = isSquare
  ? [{dw:1,dh:1}, {dw:2,dh:2}, {dw:3,dh:3}]
  : [
      {dw:1,dh:0},{dw:0,dh:1},{dw:1,dh:1},
      {dw:2,dh:0},{dw:0,dh:2},{dw:2,dh:2},
      {dw:3,dh:0},{dw:0,dh:3},{dw:3,dh:3},
    ];
```

Para etiquetas retangulares (50×30 por ex.), continua testando todas as combinações — pode fazer sentido reduzir só um lado.

### Comportamento esperado depois

| Etiqueta atual | Sugestão antes | Sugestão depois |
|---|---|---|
| 50×50 (quadrada) | 48×50 (vira retângulo, +8) | **48×48 (mantém quadrado, +8)** |
| 50×30 (retangular) | mesmo de antes | mesmo de antes |
| Ø50 (redondo, paramétrico) | Ø48 (já correto) | Ø48 (sem mudança) |

### Texto da dica

Bônus rápido: quando `newLabelW === newLabelH`, exibir "**48×48mm**" continua claro. Não precisa reformatar agora, só corrigir o conteúdo da sugestão.

## Arquivo editado

- `src/lib/labels/layout.ts` — função `findShrinkOpportunity`, restringir candidatos a simétricos quando entrada é quadrada

### Teste

Adicionar caso em `src/test/labels-layout.test.ts`:
- Entrada 50×50 em SRA3 com gap 3, margens 7/7/7/7 → sugestão deve ter `newLabelW === newLabelH` (mantém quadrado).

Aprova?