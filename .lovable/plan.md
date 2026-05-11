# Bug: "4x4" da Cor da Impressão é só placeholder

## Diagnóstico

A imagem mostra `Cor da Impressão: 4x4` mas na verdade `item.printColors` está **vazio**. O texto "4x4" exibido é apenas o `placeholder` do `SelectValue` (linha 466 de `PrintingItemEditor.tsx`):

```tsx
<SelectValue placeholder="4x4" />
```

Como nada foi efetivamente selecionado, `sideFromPrintColors(undefined)` retorna `undefined` → o filtro de papel cai no caminho "sem restrição" → as entradas `F` continuam aparecendo junto com a `F/V`.

Resumo: o filtro funciona quando o usuário **clica** no select e escolhe 4x4. Quando ele só vê o placeholder e não interage, o estado real é nulo.

## Correção

Definir `printColors` com **default real** = `"4x4"` (e `side = "F/V"`) ao criar um novo item de impressão, tornando o placeholder igual ao valor armazenado. Isso:

- Faz o filtro de papel funcionar de imediato.
- Sincroniza `bookletDuplex` corretamente (já derivado de `printColors`).
- Não muda comportamento para usuários que sempre escolhiam 4x4 manualmente.

Para etiquetas (`isLabel`), o default deve ser `"4x0"` (já que adesivo não tem verso, regra existente na UI).

## Mudanças

Arquivo único: `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (onde novos itens de impressão são criados).

1. Localizar a função/handler que cria novo item de impressão (procurar por `addPrintingItem`, `newItem`, ou onde `printColors` é definido na criação).
2. Garantir que o objeto inicial tenha:
   ```ts
   printColors: isLabel ? "4x0" : "4x4",
   side: isLabel ? "Simples" : "F/V",
   ```
3. **Itens legados sem `printColors`**: no `PrintingItemEditor.tsx`, ao montar o filtro de papel, tratar empty como `"4x4"` (ou o que o placeholder sugerir) só para o cálculo de `wantedSide`. Assim itens antigos também ficam consistentes com o que o usuário visualmente vê.

   Alternativa mais segura (escolhida): no `useEffect` inicial do editor, se `item.printColors` estiver vazio e o item não for label, dispara `onItemChange({ printColors: "4x4", side: "F/V" })` uma vez. Isso normaliza o estado.

## Out of scope
- Mudar o componente Select para mostrar o default selecionado de outra forma.
- Migração no banco de itens já salvos com `printColors` nulo.

## Arquivos editados
- `src/components/orcamentos-v2/PrintingItemEditor.tsx` — normalização inicial de `printColors`.
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — default na criação de novo item (se necessário, dependendo do que já é setado lá).
