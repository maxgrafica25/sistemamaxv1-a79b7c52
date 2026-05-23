## Sugestão de produtos pelo nome do kit + compactar "Como funciona este kit"

### Parte 1 — Sugerir produtos a partir do nome

Adicionar uma linha de **sugestão** abaixo do campo "Aplica-se aos produtos". O sistema compara o nome digitado contra os `quote_presets` ativos e propõe matches — nada é marcado sem o usuário clicar **Aplicar**.

**Comportamento**
1. Conforme o usuário digita em **Nome do kit** (debounce ~250ms), rodar matcher fuzzy contra `quote_presets` ativos.
2. Mostrar linha discreta abaixo do seletor:
   > 💡 Sugestão: `Cartão de Visita` `Folheto` — **Aplicar** · Ignorar
3. **Aplicar** → adiciona os presets sugeridos que ainda não estão nos chips.
4. **Ignorar** (ou marcar/desmarcar manual) → some até o nome mudar de novo.
5. Não sugerir presets já selecionados.
6. Ao **editar** kit existente, só sugerir se o nome for alterado pelo usuário (não disparar no load).

**Regra de match**
- Normalizar: lowercase, sem acento, sem pontuação.
- Singular/plural simples (remover `s` final).
- Match se nome do preset estiver contido no nome do kit (ou vice-versa), OU se compartilharem ≥1 token significativo (>3 letras).
- Permite múltiplos matches (ex.: "Cartão + Folheto" → 2 sugestões).
- Se nome do kit < 3 caracteres, não sugerir.

### Parte 2 — Compactar "Como funciona este kit"

O bloco atual ocupa quase metade do diálogo. Vamos manter a explicação, mas tirar do caminho.

**Mudanças**
- Trocar o painel colapsável grande por um **link discreto** ao lado do título "Itens do kit":
  > Itens do kit (0) · ⓘ Como funciona
- Clicar abre um **Popover** (não acordeão inline) com o mesmo conteúdo dos 4 passos, em fonte um pouco menor, largura ~420px.
- **Padrão fechado** sempre (não persistir estado aberto).
- Remover o card roxo grande do fluxo do formulário.

Resultado: ganha ~200px de altura útil, a explicação continua a 1 clique.

### Detalhes técnicos

- Único arquivo afetado: `src/pages/KitsProduto.tsx`.
- Helper local `suggestPresets(kitName, presets, alreadySelectedIds)` → `Preset[]`.
- Novos estados: `suggestedPresets`, `suggestionDismissed` (reset ao mudar o nome).
- Reaproveitar lista de `quote_presets` já carregada — sem novas queries nem migrations.
- Popover usa o componente shadcn já existente no projeto.
- Sem mudanças em schema, backend, outras telas ou na lógica de salvar.

### Fora do escopo

- Auto-marcar sem confirmação.
- Sugerir acabamentos/itens do kit (só presets de produto).
- Reescrever o texto da explicação.
