## Problema

No cabeçalho da Proposta Comercial, o campo **Cliente** fica visualmente "afundado" em relação aos campos vizinhos (Nº Proposta, Aos cuidados de, Validade). Os inputs vizinhos têm altura `h-9` (~36px), mas o "chip" do cliente selecionado renderiza em duas linhas (nome + empresa/telefone) com `py-2`, ficando ~60px de altura. Como o grid usa alinhamento padrão (`stretch`), o chip empurra a linha inteira e cria uma sensação de desalinhamento.

## Solução (apenas frontend / visual)

Compactar o chip de cliente selecionado em `ClientCombobox.tsx` para a mesma altura dos demais inputs do header (`h-9`), mantendo todas as informações acessíveis sem perda de funcionalidade.

### Mudanças

1. **`src/components/orcamentos-v2/ClientCombobox.tsx`** (bloco "Selected chip view", linhas ~94–111):
   - Reduzir o container para `h-9` com `py-0` e linha única.
   - Mostrar apenas o **nome do cliente** em destaque (truncado).
   - Mover empresa/telefone para um `title` (tooltip nativo) no container — a informação completa já aparece logo abaixo no bloco "Dados do cliente" expansível, então não há perda real de visibilidade.
   - Manter o ícone `User`, o badge de tipo (`cliente`/`fornecedor`) e o botão `Trocar`, todos com tamanho compatível (`size="sm"`, ícones `h-3.5 w-3.5`).
   - Resultado: chip alinhado pixel-a-pixel com `Nº Proposta`, `Aos cuidados de` e `Validade`.

2. **`src/components/orcamentos-v2/NewQuoteFormV2.tsx`** (linha 1030):
   - Adicionar `items-end` ao grid do header para garantir alinhamento consistente das bases dos campos mesmo se algum label quebrar em duas linhas em telas estreitas.

### Fora de escopo

- Nenhuma mudança em lógica de negócio, persistência, ou no comportamento de busca/seleção do cliente.
- O bloco "Dados do cliente" abaixo do header continua exibindo empresa, telefone, e-mail, etc., quando expandido.
