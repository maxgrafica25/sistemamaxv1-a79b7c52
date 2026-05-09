# Refatoração: unificar adição de processos dentro de "Acabamentos vinculados"

## Diagnóstico

Hoje, no card de cada item de impressão, o botão **`+ processo`** fica no canto superior direito do cabeçalho (renderizado em `QuoteItemsTable.tsx`, função `renderPrint`, ao lado do valor total e do botão de duplicar). Quando o usuário clica e escolhe um processo, ele é inserido no bloco **"Acabamentos vinculados"**, lá no rodapé do card — quebrando proximidade visual e exigindo que o usuário "procure" para onde o item foi.

Os blocos envolvidos:

- `src/components/orcamentos-v2/QuoteItemsTable.tsx` — cabeçalho do item de impressão (componente `ProcessPicker` montado nas linhas ~185-194).
- `src/components/orcamentos-v2/PrintingItemEditor.tsx` — toggle "Acabamentos vinculados" no rodapé (linhas 493-526), envolvendo `LaborAndSupplySubform`.

## Mudanças propostas

### 1. Cabeçalho minimalista
No `renderPrint` de `QuoteItemsTable.tsx`, **remover o `<ProcessPicker />`** do cabeçalho. O cabeçalho passa a conter apenas:

- Número do item (`1`, `2`…)
- `KindBadge kind="print"` (tag "Impressão")
- `ApprovedBadge` (quando aprovado)
- Valor total à direita
- Botão **Duplicar** (ícone)
- *(Fora de escopo: o botão de remover já vive dentro do editor; mantemos.)*

### 2. Centralizar a ação no bloco de acabamentos
No `PrintingItemEditor.tsx`, dentro do bloco `Acabamentos vinculados` (já existente), adicionar logo abaixo do `LaborAndSupplySubform` (ou no header do bloco quando expandido) um botão **`+ Adicionar Processo`** (variant `outline`, tamanho `sm`, ícone `Plus`). Ao clicar, abre o mesmo `ProcessPicker` (popover) que existia no cabeçalho.

Comportamento extra: ao clicar nesse botão com o accordion fechado, ele **abre o accordion automaticamente** antes de mostrar o popover — assim o novo item aparece dentro do bloco visível, reforçando a relação espacial.

### 3. Propagação de props
O `ProcessPicker` precisa de: `processSteps`, `processGroups`, `hourlyRate`, `onAddProcess`, `onExpandStepGroup`, `onAddCustomFinish`. Esses dados já chegam a `QuoteItemsTable` via props. Plano:

- Adicionar em `PrintingItemEditor` props novas: `processSteps`, `processGroups`, `onAddProcess`, `onExpandStepGroup`, `onAddCustomFinish` (todos opcionais para não quebrar outros usos eventuais).
- Em `QuoteItemsTable.tsx`, passar essas props ao montar `<PrintingItemEditor />` em `renderPrint`.
- Mover o componente `ProcessPicker` (atualmente declarado mais abaixo no mesmo arquivo) para um arquivo compartilhado **`src/components/orcamentos-v2/ProcessPicker.tsx`** e importá-lo nos dois lugares (ou apenas em `PrintingItemEditor`, já que sai do cabeçalho). Isso evita duplicação.

### 4. Itens já aprovados (locked)
Mantém a regra atual: quando `item.status === "aprovado"`, o botão `+ Adicionar Processo` não aparece (espelhando o `!isApproved` do código atual).

### 5. Botão "+ processo / acabamento avulso" do rodapé da tabela
**Sem alteração** — ele continua no rodapé pois adiciona itens *avulsos* (não vinculados a uma impressão). Sua função é distinta da que estamos consolidando.

## Resultado esperado

```text
┌─ 1  [Impressão]                              R$ 195,00   [⧉] ┐
│  ┌──────── Banner: Panfleto 10x14cm... ────────────────────┐ │
│  │  Tipo · Largura · Altura · Cor · Referência            │ │
│  │  Papel: Sulfite 75g — A4 F                             │ │
│  │  Quantidade: 50           R$ 195,00       [📐]   [✕]   │ │
│  │  Rendimento: 9 un/folha · Total: 6 folhas              │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │ ▾ Acabamentos vinculados (2)        [+ Adicionar Processo] │
│  │     • Blocagem ............ 10  R$ 8,50  ✕              │ │
│  │     • Cola ................  5  R$ 4,25  ✕              │ │
│  └────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

Toda interação de processos/acabamentos passa a viver num único bloco coeso.

## Fora de escopo
- Lógica de cálculo de preço e multiplicadores.
- Comportamento dos itens avulsos no rodapé da tabela.
- Bloco "Rendimento" (já tratado em outro plano).
