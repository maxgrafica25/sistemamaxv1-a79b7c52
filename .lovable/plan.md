## Objetivo

Aproximar a Calculadora de Etiquetas do padrão "Label Press": seleção rápida por abas, máximo aproveitamento da Teneth A3 (sem remover etiquetas preventivamente) e UI mais limpa. Confirmar que as marcas inferiores são ticks (já estão, mas reforçar no preview SVG).

---

## 1. Seleção de folha por abas (Tabs)

**Arquivo:** `src/components/labels/LabelCalcSettingsDialog.tsx` e/ou novo bloco no topo do `LabelLayoutCalculator.tsx`.

- Substituir o `Select` de folha por uma faixa de `Tabs` (componente `@/components/ui/tabs`) acima do card "Simulador", sempre visível (não escondido em settings).
- Botões fixos:
  - `SRA3` → 320×450 mm (já existe)
  - `A4` → 210×297 mm
  - `A3` → 297×420 mm
  - `33×48` → 330×480 mm (novo preset)
  - `Outro` → abre dialog de configurações com campos manuais
- Adicionar `33×48` em `SHEET_PRESETS` (`src/lib/labels/layout.ts`).
- Ao clicar em um preset, atualiza `config` e dispara `saveConfig` — recálculo é automático (já reativo via `useState`).

---

## 2. Máximo aproveitamento — remover slots só por colisão real

**Arquivo:** `src/lib/labels/layout.ts` (função `computeReservedSlots` e `computeLabelLayout`).

Hoje a função reserva slots fixos nos cantos (4 slots para `corte_reto`/`plotter_quadrado`, 1 para `plotter_redondo`), o que reduz a contagem mesmo quando não há colisão. Trocar por detecção geométrica:

1. Calcular o bounding box real de cada marca:
   - Top L: vértice em `(marginLeft, marginTop-2)` e `(sheetW-marginRight, marginTop-2)`, braços de 5 mm.
   - Bottom tick: linha horizontal de 10 mm centrada em `(marginLeft, sheetH-marginBottom/2)` e `(sheetW-marginRight, ...)`.
2. Calcular o bounding box de cada célula `(col, row)` na grade.
3. Marcar slot reservado **somente se** o bbox da marca intersectar o bbox da célula (com tolerância de 0,5 mm).
4. Como o vértice do L fica no canto da área útil (`marginLeft, marginTop-2`), na maioria dos casos ele cai **fora** da grade — nenhum slot precisa ser removido.

Resultado esperado: 50×50 mm em SRA3 com Teneth → grade cheia, sem perder etiquetas dos cantos.

Manter `cellsPerRow` e `rowOffsets`: linhas sem reserva ficam alinhadas à esquerda; as raras com reserva continuam centralizadas.

---

## 3. Marcas inferiores = ticks (verificar)

**Já implementado** em `src/lib/labels/marks.ts` (`buildCornerMarks` retorna `kind: "tick"` para `bl/br`) e `production-pdf.ts` (`drawMark` desenha segmento horizontal). 

Verificar no preview SVG do `LabelLayoutCalculator.tsx` que ambos os cantos inferiores são renderizados como linha horizontal única e não como L. Ajustar caso ainda use `markSegments` de forma errada.

---

## 4. UI mais limpa (estilo Label Press)

**Arquivo:** `src/components/labels/LabelLayoutCalculator.tsx`.

- Remover o select "Carregar favorito" do header do simulador (mover para popover discreto junto do botão "Salvar favorito").
- Cards com `p-5`, títulos `text-base font-semibold`, separadores sutis, badges com cores semânticas (verde para aproveitamento alto, âmbar para shrink suggestion).
- Layout 2 colunas: esquerda = "Dados do Pedido" (formato, tamanho, qty, imagem), direita = "Prévia da Folha" + "Pricing" empilhados.
- Remover ícones decorativos excessivos no header das seções; manter apenas Lucide pequeno (h-4 w-4) ao lado do título.

---

## Detalhes técnicos

**Arquivos editados:**
- `src/lib/labels/layout.ts` — nova `computeReservedSlots` baseada em bbox; novo preset `33×48`.
- `src/lib/labels/marks.ts` — exportar bbox de cada marca (`markBoundingBox(mark): {x,y,w,h}`) para reuso na detecção.
- `src/components/labels/LabelLayoutCalculator.tsx` — adicionar `Tabs` de folha no topo, redesenhar cards, verificar preview SVG das marcas.
- `src/components/labels/LabelCalcSettingsDialog.tsx` — botão "Outro" abre este dialog para entrada manual de folha.
- `src/test/labels-layout.test.ts` — atualizar testes:
  - 50×50 SRA3/Teneth → 30 etiquetas (5 cols × 6 rows), sem reservas.
  - Adicionar caso onde a etiqueta encosta no canto e o slot É removido.
  - Cobrir o novo preset 33×48.

**Ganho esperado:** etiquetas 50×50 em SRA3 passam de ~24 para 30 (cinco colunas inteiras × seis linhas dentro de 306×363 mm).

Aprova? Implemento na sequência.