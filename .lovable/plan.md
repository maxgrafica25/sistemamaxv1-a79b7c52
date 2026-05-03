## Objetivo

Tornar o "Cálculo do orçamento" da Calculadora de Etiquetas mais direto:

1. Uma **chave Adesivo / Papel** no topo do card de orçamento que filtra a lista de Impressão **e** força o acabamento correspondente (recorte adesivo vs. recorte papéis especiais).
2. Uma **escada de ancoragem mais forte** (mais faixas + opção do usuário adicionar quantidades manuais) para mandar ao cliente, no estilo do `QuoteOptionsBuilder` que já existe em Orçamentos V2.

## Mudanças na tela

No card "Cálculo do orçamento":

```text
┌─ Cálculo do orçamento ─────────────────────────┐
│ [ Adesivo ] [ Papel ]   ← novo toggle          │
│                                                │
│ Impressão  ▼ (só itens do tipo escolhido)      │
│ Acabamento ▼ (auto-vinculado, com badge "auto")│
│ Total por folha:           R$ 4,80             │
│ ...                                            │
└────────────────────────────────────────────────┘
```

No card "Sugestões de venda" (ladder):

- Mantém as 3 faixas atuais (solicitada / dobro / ideal).
- Adiciona faixas extras automáticas: `qty × 0,5`, `qty × 5`, `qty × 10` (filtradas para evitar duplicatas e quantidades absurdas).
- Adiciona um campo "Adicionar quantidade" + botão `+` para o usuário inserir tiers customizadas (ex.: 1500), persistidas em `localStorage` por sessão.
- Cada tier ganha ações: copiar linha, remover (só nas customizadas) e um botão "Copiar tabela WhatsApp" no rodapé do card que monta uma mensagem com todas as faixas (formato similar ao `formatWhatsAppQuote` atual, mas listando tiers).

## Como o sistema decide tipo / acabamento

A heurística já existe (`pickDefaultFinishing` em `sheet-pricing.ts`, casa "adesiv" / "especia" por nome). Vamos:

- Inferir o `paperKind` (`"adesivo" | "papel"`) de cada `PrintingOption` por regex no `paper_type` (`/adesiv/i` → adesivo, resto → papel). Já vem pronto na lista.
- O toggle filtra `printingOptions` na UI por esse `paperKind` antes de cair no `<Select>`.
- Quando o usuário troca o toggle, o hook seleciona o primeiro item daquele tipo (ou o último escolhido para aquele tipo, persistido).
- O acabamento continua sendo aplicado pela heurística existente — agora ela sempre vai casar, porque o tipo do papel está alinhado.

## Detalhes técnicos

**`src/lib/labels/sheet-pricing.ts`**
- Exportar helper `paperKindOf(printing: PrintingOption): "adesivo" | "papel"` (regex `/adesiv/i`).
- No hook `useFolhaPricing`, adicionar:
  - estado `paperKind` (default: o tipo do item salvo, ou "adesivo" se houver, senão "papel").
  - `printingOptionsFiltered` derivado pelo `paperKind`.
  - `setPaperKind(kind)` que troca o `printingId` para o último escolhido daquele tipo (novo campo no `SizeChoice`: `printingByKind?: Record<"adesivo"|"papel", string>`).
- Persistência em `localStorage` permanece no mesmo `CHOICE_KEY` (apenas estende o shape).

**`src/lib/labels/layout.ts`**
- Estender `buildAnchoringLadder` com um parâmetro opcional `extraQtys: number[]` que entram na escada como label `"extra"`. Manter retrocompat (default `[]`).
- Acrescentar helper `defaultExtraQtys(qty)` que devolve `[Math.round(qty*0.5), qty*5, qty*10]` filtrado (`>0`, sem duplicar tier1/tier2/tier3).

**`src/components/labels/LabelLayoutCalculator.tsx`**
- Acima do `<Select>` de Impressão, renderizar `<ToggleGroup type="single">` com `Adesivo` / `Papel` ligado ao novo `folhaPricing.paperKind`.
- Substituir `folhaPricing.printingOptions` pela versão filtrada no `<Select>`.
- No card "Sugestões de venda":
  - Estado local `customQtys: number[]` persistido em `localStorage["labelCalc:customLadderQtys:v1"]`.
  - Input + botão `+` (estilo `QuoteOptionsBuilder`).
  - Passar `customQtys` para `buildAnchoringLadder`.
  - Botão "Copiar tabela WhatsApp" que serializa as tiers (qty × unit = total).
- Atualizar `formatWhatsAppQuote` (em `src/lib/labels/whatsapp.ts`) ou criar `formatLadderWhatsApp(ladder, header)` para o novo botão.

**`src/lib/labels/whatsapp.ts`**
- Nova função `formatLadderWhatsApp(ladder, sheetSize, paperLabel, finishingLabel)` que devolve string pronta para colar.

## Fora do escopo

- Mudanças em Orçamentos V2 ou nas tabelas do banco.
- Adicionar coluna `paper_kind` em `printing_price_items` (a heurística por nome cobre os casos atuais; pode virar evolução).
- Persistir as tiers customizadas no banco (por enquanto local ao navegador).

