# Correção urgente: fazer o card estruturado aparecer no lugar do “Legado”

## Diagnóstico confirmado
O `QuoteItemsTable.tsx` já contém a tag `<PrintingItemEditor />` dentro de `renderPrint`. O problema real não é a ausência do componente no render; é a forma como `NewQuoteFormV2.tsx` separa os materiais:

- `printingItems` hoje usa `materials.filter((m) => m.baseCost && !m.parentItemId)`
- `standaloneManualMaterials` usa `materials.filter((m) => !m.baseCost && !m.parentItemId)`

Como `addEmptyPrintingItem()` cria o novo item com `baseCost: 0`, ele cai automaticamente em `standaloneManualMaterials`, que é justamente a lista renderizada como linha compacta com badge `Legado`.

Resultado visual no preview: aparece a linha “Legado” vazia, mesmo com `renderPrint` já pronto.

## O que vou alterar

### 1. `NewQuoteFormV2.tsx` — corrigir o critério de separação dos itens
Vou mudar a lógica de split para que um item novo de impressão vazio continue sendo tratado como impressão estruturada, mesmo antes de ter papel selecionado e `baseCost` calculado.

A separação passará a usar os sinais estruturais do fluxo novo, por exemplo:
- `catalogSource === "printing"`, ou
- presença de campos estruturados do item de impressão

Com isso:
- o item criado por `addEmptyPrintingItem()` entra em `printingItems`
- ele deixa de cair em `standaloneManualMaterials`
- o `QuoteItemsTable` passa a renderizar esse item via `renderPrint` com o `<PrintingItemEditor />`

### 2. `QuoteItemsTable.tsx` — manter o `renderPrint` usando o card novo
Vou validar e, se necessário, simplificar o bloco de `renderPrint` para garantir que cada item de `printingItems` continue renderizando o componente:

```tsx
<PrintingItemEditor ... />
```

Sem a linha compacta antiga no fluxo de impressão.

### 3. Verificação visual obrigatória
Depois da correção, vou validar no preview em `/orcamentos-v2/novo` que:
- a linha com badge `Legado` não aparece ao criar um item novo de impressão
- o card estruturado aparece imediatamente
- os campos `Tipo`, `Largura`, `Altura`, `Cor da Impressão` e `Papel` ficam visíveis
- o botão `+ adicionar impressão` cria novos cards estruturados
- o fluxo `processo / acabamento avulso` continua legado, separado

## Fora do escopo
- Sem mexer no banco
- Sem refatorar o `PrintingItemEditor` além do necessário para compatibilidade
- Sem alterar o fluxo legado de acabamento avulso, exceto se ele interferir diretamente nessa renderização

## Arquivos previstos
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
- `src/components/orcamentos-v2/QuoteItemsTable.tsx`