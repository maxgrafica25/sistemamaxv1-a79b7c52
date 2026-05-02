## Objetivo

Em `/acabamentos`, o formulário de "Novo acabamento" e "Editar acabamento" hoje é renderizado **inline** acima da tabela, empurrando a lista para baixo. Vamos convertê-lo para uma **janela modal sobreposta** (Dialog), mantendo a tabela sempre visível.

## Mudanças

### `src/pages/Acabamentos.tsx`
- Remover o bloco `<Card>` inline que renderiza o formulário quando `editing === true`.
- Envolver os mesmos campos (Nome, Categoria, Tamanho da folha, Preço por folha, Ordem, Ativo) em um `<Dialog>` do shadcn (`@/components/ui/dialog`), com:
  - `DialogHeader` + `DialogTitle` dinâmico ("Novo acabamento" / "Editar acabamento").
  - `DialogContent` em largura confortável (`sm:max-w-2xl`) para acomodar o grid de 3 colunas dos campos numéricos.
  - `DialogFooter` com os botões **Cancelar** e **Salvar**.
- Controlar abertura pelo state `editing` já existente: `open={editing}` e `onOpenChange` chamando `cancelEdit()` quando fechar (clicar fora / ESC / X).
- Manter intactas as funções `startNew`, `startEdit`, `cancelEdit`, `save` — só muda o container visual.
- Botão "Novo acabamento" continua na barra de filtros e segue acionando `startNew()`.

### Detalhes de UX
- Layout interno do Dialog: mesmo grid responsivo atual (`sm:grid-cols-2 lg:grid-cols-4` para os 4 campos do topo e `sm:grid-cols-3` para preço/ordem/ativo), só que dentro do `DialogContent`.
- Foco automático no campo "Nome" ao abrir (comportamento padrão do Radix Dialog).
- Sem scroll da página: o modal escurece o fundo e a tabela permanece no lugar.

## Fora do escopo
- Nenhuma mudança em RLS, schema ou regras de negócio.
- Drawer de "Faixas por quantidade" (TP1, TP2…) e botão de clonar continuam exatamente como estão.