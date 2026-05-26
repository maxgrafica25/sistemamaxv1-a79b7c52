## Problema

Hoje, ao clicar em **Trocar** (ou quando ainda não há papel selecionado), o cabeçalho compacto some e dá lugar a um bloco grande com título "Papel", toggle Frente/F/V, chips de categoria e busca. Isso desloca todo o restante do formulário (Quantidade, Faixas, Acabamentos), causando a sensação de "layout pulando".

## Solução

Transformar o picker de papel em **modal (Dialog)** que abre por cima, sem alterar o layout da página.

### Comportamento

- **Sem papel selecionado:** mostrar um cabeçalho compacto único na mesma altura do cabeçalho atual com papel selecionado:
  - Ícone Printer + texto "Selecionar papel" (ou "Selecionar adesivo", conforme `substrateLabel`)
  - Toggle Frente / F/V à direita (mantém estado mesmo sem seleção)
  - Botão primário **"Escolher"** que abre o modal
  - Se houver `suggestedPapers` (preset), abrir o modal automaticamente na primeira renderização (preservando UX dos presets), mas o layout do formulário já fica com a linha do cabeçalho ocupando a mesma altura
- **Com papel selecionado:** cabeçalho atual permanece igual; **Trocar** passa a abrir o modal (em vez de limpar e re-renderizar o bloco grande)
- **Dentro do modal:**
  - Título "Selecionar papel" / "Selecionar adesivo"
  - Toggle Frente/F/V (espelha o estado externo)
  - `PrintingItemSearch` com os mesmos chips (Todos / Comum / Especial / Adesivo) e busca
  - Ao escolher um item: `setCatalog(it)` + fecha o modal

### Arquivo

- `src/components/orcamentos-v3/forms/PrintForm.tsx`
  - Adicionar estado `pickerOpen` (boolean)
  - Substituir o bloco `{!catalog && (...)}` (linhas 404–479) por um cabeçalho compacto com botão "Escolher"
  - Envolver o conteúdo do picker em `<Dialog open={pickerOpen} onOpenChange={setPickerOpen}>` usando `DialogContent` já presente no design system (shadcn)
  - Trocar `onClick` do botão **Trocar** (linhas 529–538): em vez de `setCatalog(null)`, apenas `setPickerOpen(true)` (mantém papel atual até escolher outro; se o usuário fechar o modal sem escolher, nada muda)
  - Em `onSelect` do `PrintingItemSearch`: `setCatalog(it); setPickerOpen(false);`
  - Auto-abrir o modal quando `!catalog` e houver `suggestedPapers` (efeito único)

### Fora de escopo

- Lógica de preço, multiplicadores F/V, faixas, presets de produto
- Outros forms (BookletForm, BusinessCardForm, etc.) — só PrintForm, que é o que aparece nos presets afetados (Tags, Etiqueta, Adesivo, Personalizado de papel)

### Verificação

1. Abrir preset **Tags** → cabeçalho mostra "Couche 300 — A3 F/V" + toggle + Trocar (sem mudança).
2. Clicar **Trocar** → abre modal por cima; layout abaixo (Quantidade, Faixas) não se move.
3. Escolher outro papel → modal fecha, cabeçalho atualiza, sem salto.
4. Em "Personalizado" sem papel pré-selecionado → cabeçalho compacto com botão "Escolher"; clicar abre o modal.
5. Toggle Frente/F/V continua funcionando dentro e fora do modal (sincronizado).
