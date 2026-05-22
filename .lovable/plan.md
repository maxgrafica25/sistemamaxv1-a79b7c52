## Simplificar UX e corrigir acabamentos faltantes

### 1. Remover toggle Produtos/Personalizado
Concordo: o modo "Personalizado" passa a ser o estado padrão e os presets viram chips de favoritos visíveis no topo. Não há mais necessidade de escolher entre dois botões.

**Em `PrintAndProductForm.tsx`:**
- Remover o `ModeButton` (toggle Produtos | Personalizado) e o estado `mode`.
- Layout final:
  1. Campo "Descrição (opcional)"
  2. Linha de chips: **"✏️ Personalizado"** (selecionado por padrão) + chips de presets (ícone + nome) + botão "Salvar como preset" no fim quando houver papel selecionado
  3. Sugestão inteligente (banner já existente — agora aparece sempre que houver match, não só em modo custom)
  4. Sub-formulário (PrintForm/BookletForm/LabelEmbeddedForm) — escolhido pelo chip ativo
- Estado novo: `selectedPresetId: string | null`. `null` = Personalizado → renderiza `PrintForm` cru. Caso contrário, renderiza o form do preset (`form_tipo`).
- Limpar `selectedPresetId` ao clicar no chip "Personalizado".
- Importações de `ModeButton` removidas.

O componente `ModeButton.tsx` continua existindo (pode ser usado em outros lugares — `CVForm` ainda usa); só deixamos de importar aqui.

### 2. Acabamentos não aparecem no Personalizado — causa raiz
A consulta `listFinishings("impressao")` retorna **zero** acabamentos hoje no banco. Só existem 2 itens cadastrados, ambos marcados apenas para "etiqueta":
- Recorte Folhas Adesivas
- Recorte Folhas Papéis Especiais

Por isso o chip-list de acabamentos vem vazio. O `FinishingProgressive` renderiza uma `<ul>` vazia, sem nenhum hint visual, dando a impressão de "não aparece nada".

**Correções:**

**a) Empty state explícito no `FinishingProgressive`**
Quando `items.length === 0`, mostrar mensagem dentro do card:
> Nenhum acabamento cadastrado para Impressão.
> [Cadastrar acabamentos →] (link para `/acabamentos`)

**b) Atalho no `PrintForm`**
Logo abaixo do label "Acabamentos", quando a lista estiver vazia (e não for lona/banner — esses dois têm presets hardcoded), o mesmo CTA fica visível. Assim o usuário entende exatamente onde resolver.

**c) Não alterar dados automaticamente.** Não vou marcar os dois acabamentos existentes como `impressao` sem confirmação — o usuário decide no módulo `/acabamentos` quais aplicar a impressão.

### Validação
- `/orcamentos-v3/novo` → aba "Impressão + Acabamentos": não há mais toggle. Chip "Personalizado" ativo por padrão, chips de presets ao lado.
- Selecionar papel → ainda sem acabamentos cadastrados para impressão → aparece empty state com link para `/acabamentos`.
- Após cadastrar um acabamento com contexto "Impressão" no módulo, ele passa a aparecer automaticamente como switch na seção Acabamentos.
- Selecionar um chip de preset continua roteando para o sub-form correto (booklet/label/print).
- "Salvar como preset" continua aparecendo após selecionar um papel.
