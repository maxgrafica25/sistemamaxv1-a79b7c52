## Objetivo

Implementar exatamente o **modelo paramétrico SignMaster** descrito na especificação como um novo modo de layout para etiquetas circulares, garantindo que **folha 32×45 cm + Ø 5 cm = 40 etiquetas** (5 colunas × 8 linhas), com marcas de registro em "L" no topo e "T" embaixo.

## Conflito com o modelo atual (decisão)

O sistema hoje usa o perfil **Teneth A3** com margens **7/80/7/7 mm** (80 mm de base por causa da tração dos roletes), o que limita a área útil a 306×363 mm e faz o cálculo retornar 42 etiquetas (6×7) em vez de 40.

A nova especificação define **margens 7/7/7/7 mm**, o que produz exatamente 40 etiquetas (5×8) — mas é incompatível com a restrição física da Teneth atual.

**Solução:** adicionar um novo perfil de hardware `signmaster_param` (sem restrição de tração) que aplica as constantes da spec. O perfil Teneth permanece intacto para quem precisar dele. Como a spec representa o caso real de produção do usuário, **será definido como o novo default**.

## Mudanças

### 1. Novo perfil de hardware + constantes da spec
- Adicionar perfil `signmaster_param` em `src/lib/labels/hardware.ts` com margens 7/7/7/7 mm e sem `maxUsableW/H`.
- Tornar `signmaster_param` o `DEFAULT_HARDWARE_ID`.
- Criar `src/lib/labels/signmaster-spec.ts` com todas as constantes nomeadas: `LABEL_SPACING=3`, `REG_MARK_MARGIN=7`, `MARK_LENGTH=15`, `MARK_THICKNESS=2`, `BOTTOM_MARK_TICK=3`, `VERTICAL_NUDGE=-1` (todos em mm).

### 2. Função de layout paramétrico
Em `src/lib/labels/signmaster-spec.ts`:
- `computeSignmasterLayout({ sheetW, sheetH, labelDiameter })` retornando `{ labelsPerRow, labelsPerColumn, total, totalGridWidth, totalGridHeight, offsetX, offsetY, positions[] }` aplicando exatamente as fórmulas:
  - `step = labelDiameter + 3`
  - `labelsPerRow = floor((sheetW − 14 + 3) / step)`
  - `labelsPerColumn = floor((sheetH − 14 + 3) / step)`
  - `offsetY = (sheetH − totalGridHeight) / 2 − 1`
- `computeSignmasterMarks({ sheetW, sheetH, gridBottom, bottomMarkY? })` retornando os 4 conjuntos de segmentos das marcas (L superiores + T inferiores) já em mm absolutos da folha.

### 3. Integração no calculador (LabelLayoutCalculator)
- Quando `cutType === "plotter_redondo"` E `hardwareProfileId === "signmaster_param"`: usar `computeSignmasterLayout` no lugar de `computeLabelLayout`. Manter `labelW === labelH` (diâmetro).
- Renderizar o preview SVG das marcas pelos segmentos retornados por `computeSignmasterMarks` (substitui o uso de `buildCornerMarks` neste modo).
- Mostrar badge "SignMaster paramétrico · 7/7/7/7 mm · gap 3 mm" e a fórmula resumida.

### 4. PDF de produção e .plt
- Em `src/lib/labels/production-pdf.ts`: quando o modo paramétrico estiver ativo, emitir os círculos nas posições `(x + d/2, y + d/2)` calculadas pela spec e desenhar as marcas com espessura 2 mm.
- Geração da faca `.plt` (1016 DPI / 40 unidades por mm, origem inferior-esquerda, círculos como polígono de 72 segmentos, marcas incluídas, cabeçalho `TB26,...;CT1;` + `;:H A L0 ECN U`): novo módulo `src/lib/labels/plt-export.ts` com botão "Baixar faca .plt" exibido apenas quando o modo paramétrico está ativo.

### 5. Persistência
- Em `config-storage.ts`: ao detectar config v1 antiga com `hardwareProfileId === "teneth_a3"` e `marginsUnlocked === false`, migrar para `signmaster_param` com margens 7/7/7/7 (a menos que o usuário tenha destravado margens manualmente).

### 6. Testes
- Adicionar `src/test/signmaster-spec.test.ts` cobrindo:
  - 320×450 + Ø50 → 5×8 = 40, `offsetX≈3.2`, `offsetY≈3.2`
  - 320×450 + Ø30 → 9×13 = 117
  - 297×420 (A3) + Ø40 → cálculo conferido pela fórmula
  - Posições do primeiro e último círculo dentro da folha
  - Marcas L (TL/TR) com vértice em (7,7) e (sheetW−7, 7)

## Pontos técnicos importantes

- **Regra inviolável (spec §8):** nada de margens extras, nada de redimensionar etiqueta. Implementação 1-para-1 com as fórmulas.
- **Rodapé informativo (spec §6): NÃO implementar** (o usuário pediu para pular).
- **`bottomMarkY` manual:** input opcional no UI com slider em incrementos de 5 mm; default = `min(gridBottom + 5 mm, sheetH − 10 mm)`.
- **Compatibilidade com etiquetas quadradas:** o modo paramétrico ativa-se apenas quando `cutType="plotter_redondo"`. Para quadradas/retas o modelo atual (`computeLabelLayout`) continua valendo.

## Arquivos novos
- `src/lib/labels/signmaster-spec.ts` — constantes + cálculo de layout + cálculo de marcas
- `src/lib/labels/plt-export.ts` — gerador de faca .plt
- `src/test/signmaster-spec.test.ts` — testes da nova fórmula

## Arquivos editados
- `src/lib/labels/hardware.ts` — novo perfil + novo default
- `src/lib/labels/config-storage.ts` — migração de perfil
- `src/components/labels/LabelLayoutCalculator.tsx` — branch paramétrico + preview de marcas L/T + botão .plt
- `src/lib/labels/production-pdf.ts` — usa posições/marcas paramétricas no modo SignMaster

## Validação esperada após implementação

| Folha (cm) | Ø (cm) | Esperado | Atual (bug) |
|---|---|---|---|
| 32 × 45 | 5,0 | **40** (5×8) | 42 |
| 32 × 45 | 4,0 | 70 (7×10) | — |
| 32 × 45 | 3,0 | 117 (9×13) | — |

Aprova?
