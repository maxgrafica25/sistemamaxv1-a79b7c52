## Objetivo

Reorganizar o `LabelEmbeddedForm` para que a **folha** (SRA3 / A4) seja o eixo principal da escolha, e os chips de tamanho mostrem apenas os diâmetros disponíveis para a folha ativa. Sem mudanças em lógica de cálculo, preços ou engine.

## Mudanças

### 1. `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx`

**Reordenar a UI** (puramente apresentacional):

1. **Promover "Folha" para o topo**, logo abaixo do banner "Modo Etiqueta", como um `ToggleGroup` horizontal (SRA3 32×45cm | A4 21×29,7cm) — substitui o `Select` atual escondido lá embaixo.
2. **Filtrar os chips de presets** por `p.sheetId === sheetId`. Quando o usuário troca a folha, os chips de tamanho daquela folha aparecem (5 em vez de 10).
3. **Remover o campo "Folha"** dos grids inferiores (redonda e retangular), já que vira global no topo. O grid redondo passa a ser 2 colunas (Diâmetro + Quantidade); o retangular continua 2+1.
4. **Ajustar `applyPreset`**: como a folha já é definida pelo toggle de topo, o preset só ajusta tamanho + força papel adesivo. O `sheetId` do preset ainda é respeitado caso o usuário clique num chip de outra folha (raro, mas mantém consistência).
5. **`activePresetId`** deve ser limpo quando o usuário troca de folha manualmente.

### Layout final

```text
[Banner Modo Etiqueta]                       [Calc. completa]

Folha
( • SRA3 32×45cm )  ( ○ A4 21×29,7cm )

Tamanhos rápidos
[Ø3,5cm] [Ø4cm] [Ø5cm] [Ø6cm] [Ø7cm]

Forma: ◯ Redonda  ▢ Quadrada  ⬡ Personalizada
Diâmetro [__] cm     Quantidade [__]

Papel / Impressão  ▾
Acabamento  ▾

[Resumo de aproveitamento + total]
[Sugestões: Reduzir / Upgrade]
```

## Fora de escopo

- Nenhuma mudança em `config-storage.ts`, `signmaster-spec.ts`, `sheet-pricing.ts`, engine de cálculo, `types.ts` ou outros formulários V3.
- Sem mudanças em presets, migrações ou persistência.
- Sem alterações em `LabelCalcSettingsDialog`.
