
## Objetivo

Substituir os blocos separados (PrintingItemEditor / CVItemCard / Outros itens) por **uma única tabela inline tipo Tiny ERP**, onde cada linha pode ser **Impressão** ou **Acabamento** (mão de obra + material), escolhido pelo usuário ao adicionar a linha. Sem abas, sem drawer, sem múltiplos cliques: tudo na mesma grade fluida.

## Comportamento da nova tabela `QuoteItemsTable`

Colunas fixas:

```text
Nº | Tipo | Item (busca) | Qtde | UN | Preço un. | Preço total | Ações
```

- **Tipo**: pequeno seletor (chip) na própria linha — `Impressão` | `Acabamento` | `Serviço`. Define o ícone e o comportamento da coluna "Item".
- **Item**:
  - Se `Impressão`: usa o `PrintingItemSearch` existente (busca papel/tamanho/impressora, traz `paper_cost + printing_cost` e calcula via tier).
  - Se `Acabamento`: busca em grupos de etapas/materiais (reaproveita `LoadFromGroupDialog` em modo combobox) ou texto livre + tempo (min) → custo via `hourlyRate`.
  - Se `Serviço`: descrição livre + preço unit. (terceirizado/avulso).
- **Qtde / Preço un.**: editáveis inline. Para Impressão, ao mudar quantidade recalcula via `recalculateForQuantity` (multiplicadores A3/SRA3, F/V, faixa de markup). Para Acabamento por tempo, Preço un. = (min/60) × hourlyRate, somado ao material.
- **Ações por linha**: `⋮` → "Detalhes avançados" (abre popover compacto com campos extras só quando precisa: cobertura, máquina específica, observação interna, vincular acabamento ao item-pai). Padrão: nunca precisa abrir.
- **Adicionar linha**: dois links abaixo da tabela, idênticos ao Tiny:
  - `+ adicionar item` → cria linha vazia tipo `Impressão` (default).
  - `🔍 busca avançada de itens` → abre dialog com `PrintingItemSearch` em tela cheia para buscar e adicionar múltiplos.
- **Vínculo Impressão ⇄ Acabamento**: linha de Acabamento pode opcionalmente referenciar o `Nº` de uma linha de Impressão (campo no popover de detalhes) — mantém a lógica `parentItemId` já existente em `LaborAndSupplySubform` para travamento quando o pai é aprovado.

## Mudanças concretas

1. **Novo componente** `src/components/orcamentos-v2/QuoteItemsTable.tsx`
   - Recebe `items`, `onChange`, `markupTiers`, `globalSettings`, `hourlyRate`, `printingCatalog`.
   - Modelo unificado:
     ```ts
     type RowKind = "print" | "finish" | "service";
     interface QuoteRow {
       id: string;
       kind: RowKind;
       sku?: string;
       description: string;
       quantity: number;
       unit: string;          // un, folha, h, etc.
       unitPrice: number;
       total: number;
       parentRowId?: string;  // só para finish vinculado
       // específicos:
       printSnapshot?: PricingSnapshot;     // quando kind="print"
       finishMinutes?: number;              // quando kind="finish" por tempo
       finishMaterial?: { qty: number; unit: number };
       notes?: string;
     }
     ```
   - Linha em edição usa o mesmo layout da linha pronta (inputs sempre visíveis, sem modo "salvar/editar"), igual ao Tiny.

2. **Refator em `NewQuoteFormV2.tsx`**
   - Remover as `Tabs` ("Itens de produto" / "Descrições complementares"). Voltar a um fluxo linear.
   - Remover os blocos `PrintingItemEditor` (cards), `CVItemCard` e o "Outros itens ou serviços" duplicado. Substituir tudo por `<QuoteItemsTable />`.
   - Manter abaixo da tabela:
     - Campo único `Observações` (textarea simples — descrições complementares passa a ser só uma seção, não aba).
     - Bloco `Outros / Frete / Condições / Marcadores` já existentes.
     - `QuoteOptionsBuilder` (ancoragem por quantidade) no fim.
   - Adapter: ao salvar, converter `QuoteRow[]` para os shapes que o backend já espera (`printing_items`, `labor_items`, `materials`, `third_parties`) — assim não precisa migrar dados.

3. **Reuso, sem retrabalho**
   - `PrintingItemSearch` continua sendo a fonte de busca de impressão.
   - `recalculateForQuantity` continua calculando preço por faixa.
   - `LoadFromGroupDialog` é reaproveitado dentro do popover de detalhes de uma linha de Acabamento ("carregar grupo de etapas").
   - `PrintingItemEditor` permanece em uso como popover "detalhes avançados" (modo enxuto) só quando o usuário clica em `⋮ → Detalhes`.

4. **Header e rodapé**
   - Manter o header compacto recém-implementado, movendo `Nº Proposta` para o lado do nome do cliente como pediu.
   - Footer fixo "Salvar / Cancelar" mantido.

## Trade-offs

- **Sem abas**: tudo em uma página rolável. Mais rápido, menos cliques; em telas pequenas a tabela vira cards empilhados (responsive).
- **Detalhes avançados em popover** (não drawer): cabe na mesma tela, fecha com Esc, não tira contexto.
- **Modelo unificado `QuoteRow`** evita três listas separadas no estado, mas exige um adapter no save (mantém compatibilidade com schema atual).

## Arquivos afetados

- `src/components/orcamentos-v2/QuoteItemsTable.tsx` *(novo)*
- `src/components/orcamentos-v2/QuoteItemRowDetails.tsx` *(novo — popover de detalhes)*
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` *(refator: remove tabs e os 3 blocos antigos, integra a tabela única, adapter no save)*
