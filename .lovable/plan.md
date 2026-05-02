## Objetivo

Tornar fácil **excluir formatos (favoritos) e folhas personalizadas** cadastrados na Calculadora de Etiquetas.

Hoje:
- Existe `removeLabelPreset` no código, mas no dropdown "Carregar favorito" não há lixeira.
- A lixeira existente fica escondida dentro do popover "Salvar como favorito" — pouco descobrível.
- Folhas personalizadas só podem ser excluídas se forem a folha atualmente selecionada.

## Mudanças

### 1. `src/components/labels/LabelLayoutCalculator.tsx`

Trocar o **`Select` "Carregar favorito"** por um **`Popover` "Favoritos (N)"** com:
- Cada item é um botão clicável (carrega o favorito).
- Ao lado direito de cada item, ícone de lixeira (`Trash2`) que chama `handleRemoveFavorite` (já existe).
- Mostra também `SHAPE · WxH mm` para identificação rápida.
- Header: "Clique para carregar · lixeira para excluir".

Resultado: deletar passa a ser uma ação de 2 toques visíveis, sem precisar abrir "Salvar como favorito".

### 2. `src/components/labels/LabelCalcSettingsDialog.tsx`

Adicionar nova **seção "Favoritos de etiqueta"** logo após a seção "Folha de impressão" (antes do separador para "Tipo de corte"):

- Lista de todos os `labelPresets` salvos.
- Cada linha: nome, shape, dimensões, e botão lixeira para remover.
- Estado vazio: texto "Nenhum favorito salvo. Use o botão 'Salvar como favorito' no simulador."
- Usar `removeLabelPreset` + atualizar `draft` localmente (mesmo padrão da `handleRemoveCustomSheet` já existente para folhas).

Também melhorar a **gestão de folhas personalizadas**: trocar a lixeira atual (que só aparece quando a folha custom é a selecionada) por uma **lista completa** das folhas personalizadas com botão remover em cada linha. Mantém compatibilidade com `removeCustomSheet`.

### 3. Memória

Atualizar `mem://features/pricing` (ou criar nota curta em Core) registrando que favoritos e folhas personalizadas são gerenciáveis tanto inline (popover do simulador) quanto nas Configurações.

## Arquivos a editar

- `src/components/labels/LabelLayoutCalculator.tsx` — substituir Select por Popover de favoritos com lixeira inline.
- `src/components/labels/LabelCalcSettingsDialog.tsx` — adicionar seção "Favoritos de etiqueta" + listar todas as folhas personalizadas com remover.

## Fora do escopo

- Renomear/editar favoritos existentes (apenas excluir).
- Sincronização entre dispositivos (continua localStorage por usuário).