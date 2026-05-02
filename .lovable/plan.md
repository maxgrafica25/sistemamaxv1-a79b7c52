## Diagnóstico

Investigando `src/lib/labels/marks.ts` e o cálculo atual em `src/lib/labels/layout.ts`, encontrei a causa raiz do "conservadorismo excessivo":

**Geometria real das marcas (já implementada):**
- Marcas superiores em "L": vértice **exatamente no canto da área útil** (`marginLeft, marginTop`), com os braços de 5mm apontando para **fora** (TL: −x/−y, TR: +x/−y). Ou seja, **o L não invade a área útil em nenhum momento**.
- Ticks inferiores: traço horizontal de 10mm centrado no canto inferior, dentro da margem inferior.

**O bug:** `rectDistance` mede até o bounding box do L (5×5mm fora da área útil). Como a primeira etiqueta começa exatamente em `(marginLeft, marginTop)`, ela **toca** o vértice do bbox → distância = 0 < 10mm → o algoritmo sacrifica as pontas mesmo quando não há risco físico real.

Para 50×50mm em SRA3 com margens 7/7/7/7 e gap 1, cabem perfeitamente **6×7 = 42** etiquetas, mas o algoritmo atual remove 2 da primeira linha (e potencialmente da última), resultando em ≤40.

## Correção proposta

Substituir a heurística `rectDistance < 10mm` por **critério físico determinístico** baseado nas regras do usuário:

### 1. `src/lib/labels/layout.ts` — `computeReservedSlots`

Trocar a verificação por distância retangular pela seguinte lógica:

```text
Linha 1 (vs. L superior) está em risco SE:
  labelW > 55mm  (arte grande chega perto do vértice)
  OU marginLeft  < 5mm  (braço do L cruza a etiqueta)
  OU marginRight < 5mm
  OU marginTop   < 5mm

Última linha (vs. tick inferior) está em risco SE:
  labelW > 55mm
  OU marginLeft   < 5mm
  OU marginRight  < 5mm
  OU marginBottom < 5mm  (tick toca a etiqueta)
```

Mantém-se:
- **All-or-nothing**: se em risco, remove as duas pontas (col 0 e col N−1) e a linha é centralizada.
- **Plotter redondo**: avalia **apenas a 1ª linha**; última fica sempre cheia.
- **Plotter quadrado/personalizado**: avalia 1ª e última linha.
- **Corte reto**: nada é reservado.

Constantes exportadas para reuso/teste:
```ts
export const SAFE_LABEL_MAX_W_MM = 55;
export const SAFE_SIDE_MARGIN_MM = 5;
```

A função `rectDistance` deixa de ser usada para esse fim (pode ser removida se não houver outros consumidores — vou checar).

### 2. `src/test/labels-layout.test.ts` — novos testes

- **Meta SRA3:** `50×50mm + margens 7/7/7/7 + gap 1 + plotter_quadrado` → `effectivePerSheet = 42`, `reservedSlots = []`, todas as linhas cheias.
- **Mesmo caso com plotter_redondo** → também 42, todas cheias.
- **Etiqueta grande (60×60mm)** em SRA3 → 1ª linha (e última, se quadrado) perdem as pontas, simétrico.
- **Margem lateral apertada (3mm)** com etiqueta pequena → ainda assim aciona remoção (braço do L invade).
- Atualizar/remover o teste antigo que esperava `cellsPerRow[0] = 4` para 50×50 SRA3 (margens 7/80/7/7) — esse teste codificava o bug; a nova expectativa é linha cheia.

### 3. Sincronização com PDF e preview SVG

Já estão alinhados (correção da iteração anterior usa `cellsPerRow[r]` + `rowOffsets[r]`). Sem mudanças adicionais aqui.

## Resultado esperado

- 50×50mm em SRA3 → **42 etiquetas, grade 6×7 cheia**, badge "zona de segurança" não aparece.
- 60×60mm em SRA3 → 1ª e última linha com pontas removidas, simétricas e centralizadas.
- Comportamento determinístico, alinhado à física real do "L para fora".