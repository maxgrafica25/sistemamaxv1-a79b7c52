## Objetivo

Duas melhorias na tabela de itens do novo orçamento (`QuoteItemsTable.tsx`):

1. **Acabamento avulso por TEMPO** — em vez de digitar um valor em R$, o usuário digita o **tempo em minutos** e o sistema calcula automaticamente usando o **custo/hora** do orçamento (`valor = minutos/60 × hourlyRate`).
2. **Linha de "adicionar item" simplificada** — eliminar o dropdown "Tipo (Impressão / Acabamento / Impressão+Processo)". Ao clicar **+ adicionar item**, abrir uma única linha já em modo busca de **impressão**, com texto-guia e, ao lado, um botão discreto **"+ acabamento"** (mesmo padrão visual do que já existe ao lado de itens de impressão já adicionados).

---

## UX detalhada

### Linha de novo item (sem dropdown)

```
[ nº ] [ 🔍 Busque a impressão pelo nome (papel, gramatura, formato)…        ]  [+ acabamento]   [✕]
       ↳ Defina primeiro a impressão. Acabamentos podem ser adicionados depois.
```

- A coluna "Tipo" deixa de existir no draft — a linha ocupa o espaço com o input de busca.
- O botão **"+ acabamento"** abre o mesmo popover do `ProcessPicker` atual (busca processos cadastrados + opção "Adicionar acabamento avulso"), mas com `parentId = null` (acabamento solto, não vinculado a uma impressão).
- Ao escolher uma impressão, o draft vira uma linha de impressão padrão e uma nova linha vazia **NÃO** é aberta automaticamente (o usuário clica "+ adicionar item" de novo se quiser outra).
- Ao escolher um acabamento (avulso ou processo), o draft é consumido e cria a entrada correspondente.

### Acabamento avulso (forms inline)

Trocar o input "Valor total (R$)" por:
- **Nome** (texto) — ex.: "Corte especial"
- **Tempo (min)** (número) — ex.: 15
- Linha de preview discreta: *"≈ R$ 20,00 (custo/hora R$ 80/h)"* — recalcula em tempo real.

Aplicar nos dois pontos:
- `CustomFinishForm` (usado no `InlineCatalogCombobox` da linha draft).
- Bloco `customMode` do `ProcessPicker` (usado nos itens de impressão já existentes).
- Mini-form do `CVItemCard` (Comunicação Visual).

---

## Mudanças técnicas

### `src/components/orcamentos-v2/QuoteItemsTable.tsx`

**Draft simplificado**:
- Remover o tipo `DraftMode` e o `<Select>` de tipo na `DraftRowEditor`.
- A linha draft passa a sempre renderizar, lado a lado:
  - `<InlineCatalogCombobox>` para impressões (sem `extraTop`).
  - Botão "+ acabamento" idêntico ao `ProcessPicker` atual (já com a opção de avulso por tempo).
- Remover modos "processo" e "impressao_processo" (a busca de processo agora vem via botão "+ acabamento" ao lado).
- Atualizar o `GRID` se necessário para acomodar o input largo + botão.

**Acabamento por tempo**:
- Mudar a assinatura do callback `onAddCustomFinish`:
  ```ts
  onAddCustomFinish: (parentId: string | null, name: string, minutes: number) => void
  ```
- `CustomFinishForm` e `customMode` no `ProcessPicker`:
  - Trocar input "Valor total" por "Tempo (min)".
  - Mostrar preview `≈ R$ X,XX` calculado a partir do `hourlyRate` (já recebido por prop).

### `src/components/orcamentos-v2/NewQuoteFormV2.tsx`

Atualizar a implementação de `onAddCustomFinish`: em vez de criar um `material`, criar uma entrada de **mão de obra** (mesmo padrão de `addProcessStep`). O engine `recalculateForQuantity` já dilui automaticamente pelo `hourlyRate`.

```ts
onAddCustomFinish={(parentId, name, minutes) => {
  setLabor((prev) => [...prev, {
    id: `lbr-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
    description: name,
    timeMinutes: minutes,
    stepType: "outro",
    parentItemId: parentId,
  }]);
  toast.success(parentId ? "Acabamento avulso vinculado!" : "Acabamento avulso adicionado!");
}}
```

### `src/components/orcamentos-v2/CVItemCard.tsx`

- Adicionar prop `hourlyRate: number` (passada pelo `NewQuoteFormV2`).
- Mudar o estado `acabamentos[].custom` de `{ nome, valor }` → `{ nome, minutos }`.
- No `appliedFinishes`, sintetizar o `CVFinish` com `custo = (minutos/60) × hourlyRate`.
- Mini-form: input "Tempo (min)" + preview de R$.
- Compatibilidade: se um orçamento antigo tiver `custom.valor`, usar como fallback quando `minutos` ausente.

### `src/components/orcamentos-v2/LaborAndSupplySubform.tsx`

- Remover o botão "Acabamento avulso" do modo `compact` (não faz mais sentido com o novo fluxo via tabela). O subform fica limpo, só Mão de obra + Material + Grupos.

---

## Fora de escopo

- Sem mudanças de schema (`finishes_json` continua jsonb; `quote_labor_steps` já existe).
- Sem mudanças em `ClientViewer`, RLS ou permissões.
- Não muda persistência dos itens já salvos (orçamentos antigos continuam abrindo).
