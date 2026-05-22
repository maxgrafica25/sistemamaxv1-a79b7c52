## Objetivo

Na aba **Comunicação Visual** do orçamento v3, melhorar a experiência para banners e padronizar os presets de quantidade no mesmo formato da aba Apostilas.

## 1. Preset "Banner" — fluxo guiado

Quando o usuário clica no chip de preset **Banner** (ou marca "É banner?" manualmente):

- **Auto-ativar "É banner?"** já acontece (`applyPreset` linha 85), mas hoje um `useEffect` (linhas 103–107) sobrescreve com base no nome da mídia. Tornar a flag "sticky" após escolha explícita do preset/toggle (não resetar quando a mídia muda, a menos que ela deixe de ser lona).
- **Mostrar apenas acabamentos de banner** quando `isBanner = true`. Hoje `acabamentosView` (linhas 124–128) já filtra via `isBannerFinish`, mas a heurística inclui termos genéricos ("ilhós", "bainha") que também aparecem em lona pura. Refinar:
  - Em banner: manter qualquer acabamento que case com `bastão|banner|ponteira|cordinha|faixa|ilhós|bainha|reforço|emenda|dupla face`.
  - Em lona pura (isBanner=false): excluir explicitamente `bastão|banner|ponteira|cordinha|faixa`.
- **Sugerir o bastão com melhor aproveitamento** — já existe (`bastaoSugerido`, linhas 132–142). Reforçar visualmente:
  - Mostrar badge "Melhor aproveitamento" no chip sugerido (hoje só "sugerido").
  - Quando sobra > 10cm, mostrar dica indicando quanto sobra e oferecendo bastão menor se houver um mais ajustado.
- **Não permitir marcar dois bastões** — hoje o `onClick` (linhas 514–518) faz toggle livre. Mudar para comportamento **rádio dentro da família "bastão"**:
  - Ao clicar em um chip cuja `parseBastaoCm(nome)` não é null, remover qualquer outro bastão já marcado antes de adicionar este (ou só desmarcar, se for o mesmo).
  - O `useEffect` de auto-seleção (linhas 144–154) já evita duplicar quando algum bastão está marcado — manter.
- **Bloquear bastões que não cabem**: hoje o chip fica `opacity-50` mas continua clicável. Adicionar `disabled` quando `naoCabe = true` (largura útil > capacidade do bastão), com tooltip explicando.

## 2. Presets de quantidade — formato Apostilas

Hoje o CVForm tem só o popover `TierSimulator` (linha 465). Substituir/complementar pelo painel **sempre visível** `TierFaixasPanel` (mesmo componente já usado em `BookletForm`):

- Renderizar `TierFaixasPanel` logo abaixo do bloco Largura/Altura/Quantidade.
- Props: `currentQty`, `compute={(q) => ...}` reutilizando `calcular(...)` com a quantidade `q`, `onAddTiers={submitAsTiers}`.
- Header: `BarChart3` + "Faixas adicionais (opcional)" + subtítulo "Compare preços para outras quantidades — todas entram no mesmo bloco." (idêntico ao BookletForm).
- Conteúdo sempre visível: 4 pílulas grandes (`−5`, `+5`, `+10`, `+15`) mostrando a quantidade resultante, lista de sugestões adicionadas, campo livre "Ex: 100" + "Adicionar", botão "Limpar todas".
- Manter o `TierSimulator` ao lado do input de Quantidade? **Remover** para evitar duplicidade — toda a comparação de faixas passa pelo painel novo.

## Arquivos a modificar

- `src/components/orcamentos-v3/forms/CVForm.tsx`
  - Refinar `isBannerFinish`/`isLonaOnlyFinish` (regex).
  - Ajustar `useEffect` que define `isBanner` para não sobrescrever escolha explícita do usuário/preset.
  - Mudar onClick dos chips de bastão para seleção exclusiva.
  - Adicionar `disabled` quando bastão não cabe.
  - Importar e renderizar `TierFaixasPanel`; remover o `TierSimulator` do input de quantidade.

## Fora de escopo

- Não alterar `engine.ts`, `bastaoSuggester.ts`, `TierFaixasPanel.tsx`, persistência ou outros formulários.
- Sem alterações em estilos globais ou tokens.
