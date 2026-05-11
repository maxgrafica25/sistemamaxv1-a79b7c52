## Diagnóstico

A seção "Outras quantidades para comparar" já está implementada no `ClientViewer.tsx` (a alteração anterior funcionou). O motivo de não aparecer é outro: **nenhum orçamento tem opções salvas no banco**. Verifiquei os 5 últimos orçamentos e todos têm `quotes.options = NULL`.

A causa: o componente `QuoteOptionsBuilder` (que permite adicionar quantidades comparativas como 100/250/500 un) **existe mas não está montado em lugar nenhum** do projeto. O usuário nunca teve UI para criar essas opções.

## O que vai mudar

### 1. `NewQuoteFormV2.tsx` — montar o builder no formulário

- Adicionar estado `const [quoteOptions, setQuoteOptions] = useState<QuoteOption[]>([])`.
- Hidratar a partir de `quote.options` ao carregar (usando `parseOptions` do `lib/quotes-v2/options.ts`) no `useEffect` de edição.
- Renderizar `<QuoteOptionsBuilder snapshot={snapshot} options={quoteOptions} onChange={setQuoteOptions} />` em uma nova seção logo após o card "Valor a cobrar (base)" (linha ~1459), com um `<Separator />` e um título da seção. Local escolhido porque depende do `snapshot` (já calculado) e é informação comercial complementar ao total.
- Incluir `options: quoteOptions` no `payload` do save (linhas 818-836) para persistir no banco.

### 2. Comportamento no viewer (já funciona)

Assim que existirem 2+ opções salvas, o bloco renderiza automaticamente — sem novas mudanças no `ClientViewer.tsx` ou `OptionCard.tsx`.

## Fora de escopo

- Não vou mudar o `QuoteOptionsBuilder.tsx` (já recalcula corretamente via `recalculateForQuantity`).
- Não vou mexer em pricing, pedidos ou contas a receber.
- Não vou criar variantes por item (4x4 vs 1x1) — descartado anteriormente.

## Arquivo afetado

- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — adicionar estado, hidratação, renderização do builder e persistência no payload.
