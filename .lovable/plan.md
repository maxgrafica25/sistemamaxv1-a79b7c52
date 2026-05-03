## Ajuste: Guilhotina sem Formato (apenas Largura × Altura)

Na modalidade **Guilhotina**, o conceito de formato (Quadrado / Redondo / Personalizado) e o campo de Diâmetro não fazem sentido — o corte é sempre retangular. A UI deve refletir isso.

### Mudanças em `src/components/labels/LabelLayoutCalculator.tsx`

1. **Esconder o seletor "Formato da etiqueta"** (bloco em torno das linhas 868–887) quando `cutMode === "guilhotina"`.

2. **Forçar entrada Largura × Altura** quando `cutMode === "guilhotina"`: renderizar sempre o par de inputs `Largura` / `Altura` (ramo `shape === "personalizado"` das linhas 890–908), ignorando o estado `shape` para fins de UI no modo guilhotina.

3. **Sincronização de estado ao trocar de modo**: no `onValueChange` do ToggleGroup de `cutMode` (linha ~755), quando o usuário escolher `guilhotina`, se `shape !== "personalizado"`, chamar `setShape("personalizado")` para que `labelW`/`labelH` sejam editados de forma independente (evita arrastar diâmetro/lado único do modo Plotter).

4. **Não alterar** a lógica do motor (`computeGuillotineLayout`), os cálculos de orçamento, nem outras seções (preview, sidebar sticky, presets). O motor já trabalha com `labelW` × `labelH` retangulares.

### Fora de escopo

- Layout de 2 colunas, paleta, presets/favoritos, lógica de Plotter (SignMaster, redondo, .plt) permanecem intactos.
