## Problema

Os itens de **Arte interna** (Ajuste, Fácil, Moderada, Elaborada) não somam custo no orçamento. Hoje eles são só uma etiqueta (`art_status`). O usuário espera que sigam a mesma regra das etapas de produção: `minutos / 60 × Valor da Hora de Trabalho`.

## Solução

Tratar cada tier de Arte como um custo de mão de obra interna, usando os minutos já definidos no tier e o `hourRate` global.

### 1. Tabela de minutos por tier (fonte única)

Em `src/components/orcamentos-v3/shared/artStatus.ts`, adicionar:

```ts
export const ART_MINUTES: Record<ArtStatus, number> = {
  ready: 0,
  ajuste: 5,
  facil: 10,
  moderada: 20,
  elaborada: 30,
  terceirizada: 0, // custo entra como item terceirizado, não como hora interna
};

export function artInternalCost(status: ArtStatus | null, hourRate: number): number {
  if (!status) return 0;
  const min = ART_MINUTES[status] ?? 0;
  return (min / 60) * (hourRate || 0);
}
```

(Os tempos exibidos hoje no UI ficam coerentes — usando o **teto** de cada faixa, igual ao tooltip atual.)

### 2. Aplicar nos formulários que pedem Arte

Em `PrintAndProductForm.tsx` e `CVForm.tsx` (e demais que usam `ArtePromptBlock`), no momento de "Adicionar ao orçamento":

- Se `artStatus` for um tier interno (não `ready`, não `terceirizada`) **e** `hourRate > 0`, criar um `V3ThirdItem`-equivalente (ou um novo `V3LaborItem` se já existir) com:
  - descrição: `Arte — ${ART_LABEL[status]}`
  - custo: `artInternalCost(status, hourRate)`
  - margem: `0` (já é custo interno; entra integral no preço final via fórmula global de venda)
  - `art_status: status`
  - `bundle_id` amarrado ao item líder, igual ao que já é feito para terceirizada.

Reaproveitar o helper `makeArtThirdParty` renomeando-o internamente para aceitar `kind: "internal" | "third"`, ou criar `makeArtInternal(status, hourRate, bundleId)`.

### 3. Exibição no carrinho

`UnifiedCart.tsx` já lê `art_status` e mostra `ART_SHORT`. Como o custo agora vira uma linha real do carrinho, ele aparecerá no subtotal/Resumo Financeiro sem mudanças adicionais.

### 4. Persistência

`saveQuoteV3.ts` já grava itens terceirizados/labor; o novo item de arte interna entra pelo mesmo caminho. Nenhuma migração de banco necessária.

## Fora do escopo

- Não alterar a regra de "Terceirizada" (continua valor manual).
- Não mexer em orçamentos antigos já salvos.
- Sem mudança visual no `ArtePromptBlock` além de, opcionalmente, mostrar o R$ estimado ao lado do tier (ex.: "Fácil 5–10min · ~R$ 8,50") — posso incluir essa dica se quiser.

## Pergunta única antes de implementar

Deseja usar o **teto** de cada faixa para o cálculo (5/10/20/30 min) — opção mais conservadora — ou a **média** (3/7,5/15/25 min)? Default sugerido: **teto**, igual ao tooltip atual.
