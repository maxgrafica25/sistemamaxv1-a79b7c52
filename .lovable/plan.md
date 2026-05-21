## Diagnóstico

No painel **Kit Encadernação** do Orçamentos V3 (`BookletKitPanel.tsx`), o botão **"+ Adicionar acabamento"** cria um slot que abre o `CustomCoverEditor` — um editor de **impressão/papel** (busca em `printing_price_items`). Isso não faz sentido para acabamentos avulsos (laminação, capa dura, espiral extra, wire-o, etc.), que são **suprimentos** cadastrados na tabela `supplies`.

A busca correta deve usar `SupplySearch` (mesmo catálogo de Suprimentos usado em `SupplyForm.tsx`), gerando um `V3SupplyItem` em vez de um `V3PrintItem`.

## Plano

1. **Substituir o editor de cada slot extra** no `BookletKitPanel.tsx`
   - Trocar `CustomCoverEditor` por um seletor de **suprimento** baseado em `SupplySearch` (mesmo componente já usado em `SupplyForm`).
   - Cada slot passa a guardar: suprimento selecionado, quantidade e margem (com fallback para `margem_pct` do suprimento ou `defaultMarginPct`).
   - Campo opcional “Nome do acabamento” continua disponível para sobrescrever a descrição.

2. **Construir um `V3SupplyItem` ao aplicar**
   - No `apply()`, para cada `extraSlot` montar um item com `kind: "supply"` (espelhando o `buildItem` de `SupplyForm.tsx`): `supply_id`, `supply_nome`, `fornecedor`, `custo_unitario`, `margem_pct`, `quantidade`, `descricao` (label do slot ou `supply.produto`).
   - Remover a validação “escolha o papel” — passar a validar “escolha o suprimento”.

3. **UI compacta do slot**
   - Cabeçalho: ícone ✨ + input do nome + botão remover (igual hoje).
   - Corpo enquanto não selecionado: `SupplySearch` + campo Quantidade (default 1).
   - Quando suprimento escolhido: resumo em uma linha (`Produto · fornecedor · qtd × custo = total`) com botão **Editar** para trocar/ajustar quantidade.
   - Mensagem amarela “Itens em amarelo não foram encontrados no cadastro” continua só para o kit padrão (não se aplica a slots de suprimento).

4. **Não alterar** o comportamento de “Capa frontal / Contracapa Personalizada” — essas continuam sendo impressão personalizada (via `CustomCoverEditor`), porque ali o usuário realmente está escolhendo um papel impresso. A mudança vale apenas para os slots criados pelo botão **+ Adicionar acabamento**.

5. **Validação no fluxo**
   - `/orcamentos-v3/novo` → Apostila → **+ Adicionar acabamento** → buscar “Espiral”, “Wire-o”, “Laminação BOPP” etc. no catálogo de suprimentos.
   - Aplicar e conferir que o item entra no carrinho como **Suprimento** (badge “Suprimento”), com fornecedor e quantidade corretos.

## Detalhes técnicos

- Arquivo único impactado (frontend): `src/components/orcamentos-v3/forms/BookletKitPanel.tsx`.
- Tipos: trocar `ExtraSlot.item: V3PrintItem | null` por algo como:
  ```ts
  type ExtraSlot = {
    id: string;
    label: string;
    supply: SupplyOption | null;
    qty: number;
    margemPct: number;
    collapsed: boolean;
  };
  ```
- Imports novos: `SupplySearch`, `SupplyOption` de `@/components/orcamentos-v2/SupplySearch`; `genId`, `V3SupplyItem` de `../types`.
- Sem mudanças em backend, schema ou outros formulários.
