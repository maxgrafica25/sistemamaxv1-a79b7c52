## Objetivo
Na mensagem do WhatsApp, mostrar **apenas 3 sugestões** além da quantidade solicitada:
1. Uma quantidade **menor** (mais próxima abaixo da solicitada)
2. **+50%** (mais próxima de `qty * 1.5`)
3. **+100%** (mais próxima de `qty * 2`)

## Onde alterar
`src/lib/labels/whatsapp.ts` — função `formatWhatsAppQuote` (usada pelo botão "Copiar para WhatsApp" em `LabelLayoutCalculator.tsx`).

Hoje ela lista **todas** as outras faixas da escala (`ladder.filter(t => t.qty !== qty)`). Vamos restringir a no máximo 3 picks selecionados da `ladder`.

## Lógica de seleção
Dado `ladder` (ordenada crescente por qty) e `qty` solicitado:

- **smaller**: maior tier com `t.qty < qty` (se existir)
- **plus50**: tier de `ladder` cuja qty seja a mais próxima de `qty * 1.5` e `> qty`
- **plus100**: tier cuja qty seja a mais próxima de `qty * 2` e `> qty` e diferente de plus50

Se `plus50 === plus100`, escolhe o próximo tier maior disponível para preencher o slot de +100% (fallback: o maior tier `> plus50.qty`). Se não houver candidatos, simplesmente omite o slot.

Renderização mantém o formato atual ("📊 Outras quantidades:" + linhas com economia em %), só que limitado a esses 3 picks (ordenados: smaller, plus50, plus100). A frase final "Quanto maior a quantidade, menor o custo unitário 😉" continua.

## Não muda
- `formatLadderWhatsApp` (botão "Copiar tabela WhatsApp" da escala) — continua como está, pois é uma feature distinta.
- Nenhuma mudança de UI/layout.
- Testes existentes em `src/test/labels-layout.test.ts` que apenas verificam presença de substrings continuam válidos; se algum quebrar por contagem de linhas, ajusto.

## Snippet (referência)
```ts
const smaller = [...ladder].reverse().find(t => t.qty < qty) ?? null;
const larger = ladder.filter(t => t.qty > qty);
const pickClosest = (target: number, exclude: Set<number>) =>
  larger
    .filter(t => !exclude.has(t.qty))
    .sort((a, b) => Math.abs(a.qty - target) - Math.abs(b.qty - target))[0] ?? null;

const used = new Set<number>();
const plus50 = pickClosest(qty * 1.5, used); if (plus50) used.add(plus50.qty);
let plus100 = pickClosest(qty * 2, used);
if (!plus100 && plus50) {
  // fallback: próximo maior depois de plus50
  plus100 = larger.find(t => t.qty > plus50.qty) ?? null;
}

const picks = [smaller, plus50, plus100].filter(Boolean);
```
