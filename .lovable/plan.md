## Objetivo
Espelhar o padrão real do SignMaster/Teneth observado no PDF de referência (Rosane_Tags_38): marcas superiores em "L", marcas inferiores em traço simples, primeira/última linha com menos etiquetas centralizadas, e adicionar seletor mm/cm.

## O que o PDF de referência ensina

1. **Marcas superiores (TL + TR)** = "L" abrindo para dentro da folha. Vértice no canto da área útil.
2. **Marcas inferiores (BL + BR)** = um único traço horizontal curto (≈10mm) na base — NÃO são L. O sensor da plotter só precisa de uma referência horizontal pra fechar a leitura ARMS na descida.
3. **Linhas de topo e base têm menos etiquetas que as linhas do meio**, e ficam **centralizadas horizontalmente** dentro da área útil. Não é só o slot [0,0] que sai — sai uma "borda" inteira de etiquetas das duas pontas dessas linhas pra abrir folga em volta das marcas.
4. **Linhas internas** ocupam toda a largura útil normalmente.

Isso muda a regra de slots reservados: em vez de "1 slot no canto", reservamos **uma faixa lateral** (1 coluna) nas pontas da linha 0 e da linha N−1 — exatamente o que o exemplo mostra.

## Revisão do plano

### A. Marcas (`src/lib/labels/marks.ts` — reescrita)
- Tipo unificado `RegistrationMark` com `kind: 'L' | 'tick'`
  - `L`: vértice + 2 segmentos perpendiculares (5mm cada perna)
  - `tick`: traço único horizontal de 10mm
- `buildCornerMarks(...)` retorna 4 marcas:
  - TL e TR → `kind: 'L'`, vértice recuado 2mm para dentro da margem (canto da área útil)
  - BL e BR → `kind: 'tick'`, centro horizontal alinhado ao canto da área útil, posicionado dentro da margem inferior
- Helper `markSegments(mark)` retorna lista de segmentos (1 para tick, 2 para L) com orientação correta por canto
- `nudgeY` aplica a TODOS os 4 (Ls e ticks) preservando alinhamento
- Constantes: `MARK_ARM_MM=5`, `TICK_LEN_MM=10`, `MARK_STROKE_PT=0.5`

### B. Reserva por faixa em vez de slot único (`src/lib/labels/layout.ts`)
Estender `LayoutResult`:
- `rowOffsets: number[]` — offset X (mm) inicial de cada linha
- `cellsPerRow: number[]` — quantas etiquetas vendáveis por linha
- `effectivePerSheet` = soma de `cellsPerRow`

Regra nova de reserva por `cutType`:
- `plotter_redondo`: reserva **1 etiqueta na linha 0 (à esquerda)** + centraliza a linha 0
- `corte_reto` / `plotter_quadrado`: reserva **1 etiqueta nas duas pontas da linha 0** + **1 etiqueta nas duas pontas da última linha** + centraliza ambas (visual igual ao PDF de referência)

Centralização: largura ocupada = `cellsPerRow[r] * labelW + (cellsPerRow[r]-1) * gap`; offset = `marginLeft + (usableW − ocupada) / 2`.

Linhas internas mantêm `cellsPerRow[r] = cols` e offset = `marginLeft`.

`reservedSlots` continua existindo (lista de `{col,row}` removidos), agora derivado dessa regra de faixa.

### C. SVG (`SheetPreview` em `LabelLayoutCalculator.tsx`)
- Usar `rowOffsets[r]` para posicionar cada etiqueta vendável
- Slots reservados: **não desenhar nada** (espaço em branco real)
- Marcas via `markSegments`: 2 segmentos pretos para L, 1 segmento para tick. `stroke="black"`, espessura ~0.5pt convertida para mm
- Manter `strokeLinecap="round"` para visual idêntico ao PDF

### D. PDF de produção (`src/lib/labels/production-pdf.ts`)
- `drawMark(page, mark)` usa `markSegments` para K100 0.5pt
- Posicionamento das etiquetas via `rowOffsets`
- Slots reservados: nada desenhado

### E. Seletor mm/cm
- Campo `unit: 'mm' | 'cm'` em `LabelCalcConfig`, default `mm`
- `LabelCalcSettingsDialog`: nova seção "Unidade de medida" com `ToggleGroup`
- `LabelLayoutCalculator`:
  - Helpers `toDisplay(mm, unit)` e `fromDisplay(val, unit)` (cm = mm/10)
  - Labels mostram `(mm)` ou `(cm)`; `NumInput` recebe valor em mm e converte para exibição
  - Step adaptado: cm usa step=0.1, mm usa step=1
  - Slider de nudge: range −10mm/+10mm convertido para −1cm/+1cm com step 0.05cm
- Cálculos internos sempre em mm (intocados)

### F. Testes (`src/test/labels-layout.test.ts`)
- `markSegments` retorna 2 segmentos para L com sinais corretos por canto, 1 segmento para tick
- `buildCornerMarks` produz 2 Ls (TL/TR) + 2 ticks (BL/BR)
- `computeLabelLayout` com `cutType='corte_reto'` produz `cellsPerRow` com −2 na primeira E última linha (e linhas do meio com `cols`)
- `rowOffsets` centralizam as linhas com reservados
- `effectivePerSheet` = soma de `cellsPerRow`
- `nudgeY` desloca todas as 4 marcas em conjunto
- Conversão mm↔cm bidirecional

## Arquivos
**Editar:**
- `src/lib/labels/marks.ts` — reescrita (L + tick)
- `src/lib/labels/layout.ts` — `rowOffsets`, `cellsPerRow`, regra de faixa
- `src/lib/labels/config-storage.ts` — campo `unit`
- `src/lib/labels/production-pdf.ts` — `drawMark` e posicionamento por `rowOffsets`
- `src/components/labels/LabelLayoutCalculator.tsx` — SVG novo, conversão mm/cm
- `src/components/labels/LabelCalcSettingsDialog.tsx` — toggle mm/cm
- `src/test/labels-layout.test.ts` — novos casos

**Sem novos arquivos. Sem novas dependências.**

## Observações
- A "reserva por faixa" reduz `effectivePerSheet` mais do que a versão atual (perde 4 etiquetas em vez de 2 no corte_reto), mas é o que reflete o layout real e produz folha sem risco de colisão arte↔marca.
- O PDF mostra o "L" inferior como `tick` simples — provavelmente convenção do SignMaster pra distinguir início/fim de leitura. Mantemos essa convenção fiel.
- Aspecto cosmético do PDF de referência também tem rotação 90° das etiquetas (mais cabe assim) — isso já é decidido pelo nosso algoritmo de rotação automática quando dá ganho.

Aprova? Implemento.