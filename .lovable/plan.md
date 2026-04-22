

# Reformular ProductPicker: vincular como ação primária, cadastrar como secundária

## Diagnóstico

Hoje o `ProductPicker` mistura "buscar" e "cadastrar" no mesmo input, sem hierarquia visual. Como o catálogo está vazio (você acabou de limpar tudo), a lista aparece sem opções e o único caminho visível é digitar para criar um produto novo "no escuro" — sem categoria, dimensões, gramatura ou observações. Isso é confuso e gera produtos canônicos pobres.

A solução pedida é: tratar o caminho **vincular a existente** como o normal, e oferecer **cadastrar novo** apenas como botão pequeno dentro do popover, abrindo um **formulário completo** (igual ao da página Catálogo Produtos).

## Solução

### 1. Reestruturar o popover do `ProductPicker.tsx`

Estrutura nova (de cima para baixo dentro do `PopoverContent`):

```
┌──────────────────────────────────────────────┐
│ 🔍 Buscar produto no catálogo...             │  ← CommandInput (só busca)
├──────────────────────────────────────────────┤
│ Produtos do catálogo                         │
│ ✓ Panfleto 10x14 Couché 90g     [panfleto]  │
│   Banner 80x120 Lona            [banner]    │
│   ...                                        │
├──────────────────────────────────────────────┤
│ + Cadastrar novo produto no catálogo         │  ← botão pequeno, no rodapé
└──────────────────────────────────────────────┘
```

Mudanças concretas:

- **Remover** o botão "Cadastrar: '<texto>'" no topo (atualmente ocupa o lugar de destaque) e a lógica `handleCreateNew` que cria um produto "fantasma" só com o nome digitado.
- **Remover** a frase `(novo)` no trigger label e o helper "Será criado um novo produto: ...".
- **Trigger label** simplificado: `"Selecione um produto do catálogo..."` (ou nome do selecionado).
- **CommandInput** muda placeholder para `"Buscar produto..."` — função única: filtrar.
- **CommandEmpty**: quando nada bate com a busca, exibir mensagem `"Nenhum produto encontrado."` + botão `"Cadastrar novo produto"` que dispara o item 2.
- **Rodapé fixo do popover** (sempre visível, abaixo da lista): pequeno botão `variant="ghost" size="sm"` com ícone `Plus` e texto `"Cadastrar novo produto no catálogo"`. Pré-preenche o campo Nome do formulário com o texto que estiver no input de busca (se houver).
- **Carregar o catálogo completo** (não só os que têm site vinculado). Hoje filtra `idsComSite.has(p.id)` — isso esconde produtos recém-criados que ainda não têm link, justo o caso de uso.

### 2. Novo componente `NovoProdutoCatalogoDialog.tsx`

Pequeno dialog reutilizável extraído da lógica de "Novo produto" da página `Produtos.tsx`. Mesmos campos:

- Nome canônico * (string)
- Categoria (string lowercase)
- Dimensões (string)
- Gramatura (string)
- Observações (string)

Props:
```ts
type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName?: string;          // pré-preenche Nome com o que está na busca
  initialCategoria?: string;     // pré-preenche com a categoria já escolhida no NovoSiteDialog
  onCreated: (produto: ProdutoCatalogo) => void;  // devolve o produto criado para auto-vincular
};
```

Ao salvar:
1. `INSERT` em `produtos_catalogo`.
2. Toast `"Produto cadastrado"`.
3. Chama `onCreated(novoProduto)` — o `ProductPicker` então atualiza sua lista interna, seleciona automaticamente esse produto (`onChange({ id: novo.id, name: novo.nome_canonico })`) e fecha o popover.

### 3. Reuso na página `Produtos.tsx` (opcional, mas limpa)

A página `Produtos.tsx` tem hoje um Dialog inline com a mesma lógica. Substituir por `NovoProdutoCatalogoDialog` (passando `initialName` e callback de refresh) elimina duplicação. Edição continua inline (ou fazemos o mesmo dialog aceitar modo edição — recomendo manter edição inline por simplicidade, só extrai o "novo").

### 4. Ajuste de tipo no contrato `onChange`

Como agora **toda** seleção no `ProductPicker` resulta num produto que existe no banco (nunca mais um `id: null` "fantasma"), simplificar o callback:

```ts
onChange: (val: { id: string; name: string }) => void
```

E no `NovoSiteDialog.handleSave` remover o ramo que chama `findOrCreateCatalogo` quando id é `null` (ele continua existindo no `lib/produtoCatalogo.ts` e segue sendo usado por outros consumidores, então não removo a função, só a chamada agora desnecessária aqui — se o id chega preenchido, usa direto).

## Arquivos afetados

- `src/components/monitoramento/ProductPicker.tsx` — reestruturação do popover + remoção do "criar inline".
- `src/components/monitoramento/NovoProdutoCatalogoDialog.tsx` — **novo arquivo**.
- `src/components/monitoramento/NovoSiteDialog.tsx` — ajustar handler do `ProductPicker` para o novo contrato e reaproveitar `selectedCategoria` ao abrir o dialog de novo produto.
- `src/pages/Produtos.tsx` — (opcional) trocar dialog inline pelo novo componente.

## Fora de escopo

- Lógica de scraping, schema, RLS, triggers, `findOrCreateCatalogo` — intactos.
- Renomeação de abas, layout do `NovoSiteDialog` em si — intactos.

## Risco

Baixo. Mudança principalmente de UI; o contrato fica mais estrito (`id` sempre presente), o que reduz bugs futuros. O dialog de cadastro reutiliza colunas que já existem em `produtos_catalogo`.

