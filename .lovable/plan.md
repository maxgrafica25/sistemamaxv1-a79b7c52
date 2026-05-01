## Objetivo
Evoluir a Calculadora de Etiquetas para virar ferramenta de pré-impressão real para a Plotter Teneth A3 / SignMaster, mantendo o que já existe (simulador, presets, upload de imagem, WhatsApp, otimizador de retalho).

## O que já está pronto (não tocar)
- Split UI Simulador + Dialog de Configurações com persistência em `localStorage`
- Presets de folha (A4/A3/SRA3/Carta) + folhas customizadas
- Favoritos de etiqueta (Lacre 40, Validade 20, Redonda Ø50 já seedados)
- Upload de imagem PNG/JPG/WEBP (≤2MB) com `object-fit: contain` + alerta de proporção
- Formas Quadrado/Redondo/Personalizado com SVG (rect / circle + clipPath)
- Pricing arredondado pra cima ao R$ 0,10, ancoragem (200/300/500…), WhatsApp copy/abrir
- Otimizador de retalho (−1/−2/−3 mm)
- 46 testes verdes em `src/test/labels-layout.test.ts`

## O que falta (este plano)

### 1. Perfil de hardware "Teneth A3 / SignMaster"
Adicionar em `src/lib/labels/layout.ts`:
- Novo `HardwareProfile` com: `marginTop=7`, `marginLeft=7`, `marginRight=7`, `marginBottom=80`, área útil máx `306×363mm` na SRA3
- Função `clampToHardware(input, profile)` que valida margens mínimas e área útil
- Constante `HARDWARE_PROFILES` com `teneth_a3` (default) e `generico` (atual)

No `LabelCalcSettingsDialog`:
- Novo seletor "Perfil de hardware" no topo da seção Margens
- Ao escolher Teneth A3, força margens para os valores reais e desabilita edição (com botão "destravar para ajuste fino")
- Persistir `hardwareProfileId` em `LabelCalcConfig`

### 2. Slots reservados para marcas de registro (ARMS)
Em `layout.ts`:
- Estender `LayoutResult` com `reservedSlots: Array<{col,row}>` e `effectivePerSheet` (= total − reservados)
- Regras por `cutType`:
  - `plotter_redondo` → reserva slot `[0,0]`
  - `corte_reto`/`plotter_quadrado` → reserva `[0,0]` e `[cols-1, rows-1]`
- `computeSheetPricing` e `buildAnchoringLadder` passam a usar `effectivePerSheet`
- `findShrinkOpportunity` também — comparação justa

No SVG `SheetPreview`:
- Renderizar slots reservados com hachura cinza + ícone `+` (marca ARMS) em vez da etiqueta
- Tooltip "Reservado para marca de registro"

### 3. Nudge vertical das marcas de registro
No simulador:
- Novo `Slider` "Ajuste vertical das marcas (mm)" range −10…+10mm, default 0
- Estado local `marksOffsetY` (não persiste — é por job)
- Função `suggestMarksOffset(layout)` que calcula o offset que centraliza as marcas no gap mais próximo, retorna sugestão com botão "Aplicar sugestão"
- SVG desenha as marcas (cruz + círculo de leitura) no canto da folha aplicando o offset

### 4. Geração de PDF de produção (1:1)
Novo arquivo `src/lib/labels/production-pdf.ts` usando **pdf-lib** (já no stack ou adicionar via `bun add pdf-lib`):
- `generateProductionPDF({config, layout, image, shape, marksOffsetY})` retorna `Blob`
- **Página 1 — Impressão**: arte posicionada nas etiquetas + marcas de registro em K100 (CMYK puro)
- **Página 2 — Faca de corte**: apenas contornos stroke 0.25pt, cor Spot `CutContour` (100% Magenta como fallback RGB), formato seguindo `shape`
- Quadrado de teste 10×10mm no canto inferior esquerdo (fora da área útil) para conferência de escala
- Página em mm 1:1 (usar `PageSizes` custom calculado de `sheetW × sheetH`)

Botão no card de pricing (ao lado do WhatsApp):
- "Gerar PDF de produção" → download do PDF + toast

### 5. Testes
Adicionar em `src/test/labels-layout.test.ts`:
- `reservedSlots` corretos para cada `cutType`
- `effectivePerSheet` = total − reservados (clampado a ≥0)
- `pricing` usa effective, não bruto
- `clampToHardware` rejeita margens menores que perfil
- `suggestMarksOffset` centraliza no gap

PDF não tem teste unitário automático — só QA manual (download + abrir no SignMaster).

## Arquivos
**Editar:**
- `src/lib/labels/layout.ts` — hardware profiles, reserved slots, effective per sheet
- `src/lib/labels/config-storage.ts` — `hardwareProfileId` no `LabelCalcConfig`
- `src/components/labels/LabelCalcSettingsDialog.tsx` — seletor de perfil
- `src/components/labels/LabelLayoutCalculator.tsx` — slider nudge, botão PDF, SVG com slots reservados e marcas
- `src/test/labels-layout.test.ts` — novos casos

**Criar:**
- `src/lib/labels/hardware.ts` — perfis (Teneth A3, Genérico) e helpers
- `src/lib/labels/marks.ts` — geometria das marcas de registro + `suggestMarksOffset`
- `src/lib/labels/production-pdf.ts` — geração do PDF 2 páginas

**Dependência nova:** `pdf-lib` (~200KB, sem deps nativas).

## Riscos / Notas
- `pdf-lib` não tem suporte nativo a cores Spot (CutContour). Vamos exportar como Magenta 100% (RGB 255,0,255) com nome de camada `CutContour` no PDF — o SignMaster reconhece pelo nome do contorno em workflows recentes; se a planta usar versão antiga, marcar visualmente como "M100" e o operador pode mapear na importação. Documentamos isso num tooltip no botão.
- Marcas de registro do Teneth seguem o padrão ARMS de 4 cantos — vou desenhar como cruzes 5×5mm + círculo de leitura, mas o operador precisa validar a primeira impressão real.
- Se margens do hardware Teneth + área útil máx (306×363) entrarem em conflito com SRA3 (320×450), o `clampToHardware` reduz para o menor — o usuário verá um aviso amarelo no simulador.

Aprova? Se sim, implemento tudo de uma vez.