## Problema

Implementei o toggle "É banner?" e a sugestão de bastão no **PrintForm** (aba "Impressão + Acabamentos"), mas você está usando a aba **Com. Visual** (CVForm), onde Lona Brilho é selecionada como mídia do catálogo CV. Por isso nada apareceu.

A aba CV já tem seus próprios chips de acabamentos vindos do banco (Refile (Lona), Banner Bastão 105/150/205cm, Faixa, Dupla Face, Ilhós, Bainha, Emenda — visíveis no print). O que falta é a lógica de **detectar banner**, **separar acabamentos de lona vs banner** e **sugerir o bastão correto** pela largura.

## Plano

### 1. Detectar Lona e exibir toggle "É banner?"
Em `CVForm.tsx`, após a seleção de mídia:
- `isLona = /lona|banner|vinil/i.test(midia?.tipo_midia || midia?.nome || "")`
- Quando `isLona`, mostrar `Switch` "É banner?" ao lado do bloco da mídia (default `true` se o nome da mídia já contém "banner").

### 2. Filtrar acabamentos por modo (Lona × Banner)
Classificar cada acabamento de `acabamentosCompat` pelo nome:
- **Banner** (`isBanner=true`): nomes contendo `banner`, `bastão`, `bastao`, `ponteira`, `cordinha`, `ilhós/ilhos`, `bainha`, `emenda`, `dupla face`.
- **Lona** (`isBanner=false`): nomes contendo `refile`, `lona`, `ilhós`, `bainha`, `dupla face` — **excluindo** os de bastão/banner.
- Quando não é lona, manter comportamento atual (mostra todos).

Acabamentos atualmente selecionados que saírem do conjunto são removidos automaticamente (já existe efeito similar — adapto).

### 3. Sugestão de bastão pela largura do banner
Usar o mesmo `bastaoSuggester.ts` já criado.

Como os bastões aqui são chips do catálogo (105/150/205cm), a sugestão funciona assim:
- Calcular `necessario = largura_cm + 2*1cm`.
- Identificar nos chips de "Banner ... até XXXcm" os tamanhos disponíveis no catálogo (parse do número no nome).
- **Sugerir** (visualmente destacado com ring/badge "Sugerido") o menor chip cujo número ≥ `necessario`.
- Os chips que **não cabem** ficam visualmente atenuados (opacity-50) com tooltip "Não cabe na largura + 2cm de sobra".
- Auto-marcar o chip sugerido **apenas se** nenhum chip de bastão estiver marcado ainda.
- Se nenhum chip cabe (banner > 198cm), mostrar aviso amarelo: *"Necessária emenda — considere usar o chip 'Emenda' junto."*

Não vou alterar a engine de preço — apenas guia visual + auto-seleção.

### 4. UI mínima
- Toggle "É banner?" no canto direito da linha de mídia (igual ao PrintForm).
- Pequena legenda abaixo do grupo de chips quando isLona+isBanner: *"Sugestão baseada em largura + 2cm de sobra para ponteiras."*

### Arquivos
- **Modificar**: `src/components/orcamentos-v3/forms/CVForm.tsx`
- **Reusar**: `src/components/orcamentos-v3/shared/bastaoSuggester.ts` (sem mudanças)

### Fora de escopo
- Alterar a engine de cálculo CV (`@/lib/cv-calc/engine`) — sugestão é apenas visual + auto-seleção do chip já existente.
- Remover a implementação prévia do PrintForm (fica como fallback caso alguém crie lona via "Impressão + Acabamentos").

Confirma para eu aplicar?