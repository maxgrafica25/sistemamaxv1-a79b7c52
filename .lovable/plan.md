## Problema

Ao criar nova versão, os itens aprovados são copiados mantendo o `sort_order` original. Quando há um item aprovado no meio (ex.: posição 2) e itens editáveis acima/abaixo, fica difícil entender o que ainda pode ser ajustado. O usuário quer que **os aprovados (travados) fiquem no topo** e os **editáveis fiquem na parte de baixo**, próximos ao botão `+ adicionar item`.

## Solução

Reordenação **somente visual** na tabela de itens (`QuoteItemsTable`), sem mexer em `sort_order` no banco nem na RPC `create_quote_version`. A numeração das linhas (Nº 1, 2, 3) continua sequencial conforme a nova ordem exibida.

### Regra de ordenação

Para cada lista renderizada (`printingItems` e `standaloneManualMaterials`):
1. Itens com `status === "aprovado"` primeiro, na ordem original (`sortOrder`).
2. Demais itens (pendentes/editáveis) depois, também na ordem original.

Itens "Print" filhos (processos/acabamentos vinculados a um item Print) continuam logo abaixo do pai — a ordenação acontece no nível do pai, não quebra os agrupamentos.

`standaloneLabor` e `thirdParty` (não têm status de aprovação) continuam após esses dois grupos, como hoje.

## Arquivo afetado

- `src/components/orcamentos-v2/QuoteItemsTable.tsx`
  - Antes do `return`, criar versões ordenadas:
    ```ts
    const sortByApproved = <T extends { status?: string | null }>(arr: T[]) =>
      [...arr].sort((a, b) => {
        const ap = a.status === "aprovado" ? 0 : 1;
        const bp = b.status === "aprovado" ? 0 : 1;
        return ap - bp;
      });
    const printingOrdered = sortByApproved(printingItems);
    const manualOrdered = sortByApproved(standaloneManualMaterials);
    ```
  - Substituir os `.map` de render por `printingOrdered` e `manualOrdered`.
  - Ajustar os offsets de `rowNumber` para usar os tamanhos dessas listas (já são iguais).

## Fora de escopo

- Persistir nova ordem no banco (`sort_order`).
- Mudar a RPC `create_quote_version`.
- Reordenar filhos (processos) — eles seguem o pai automaticamente.
