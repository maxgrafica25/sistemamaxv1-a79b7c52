# Popular Imposto e Taxa cartão a partir das Configurações Globais

## Causa

O estado inicial do orçamento V3 (`DEFAULT_STATE` em `types.ts`) traz `tax_pct: 0` e `fees_pct: 0`. O `wastePct` é lido de `globalSettings`, mas tax/fees nunca recebem os valores do banco. Resultado: todo orçamento novo começa com Imposto 0% e Taxa cartão/fatura 0%, e essas linhas não somam nada no resumo financeiro.

## Correção

Em `NewQuoteFormV3.tsx`, ao final do carregamento de `useGlobalSettings()`, sincronizar uma única vez no `state`:

- `state.tax_pct ← globalSettings.tax_pct` (imposto)
- `state.fees_pct ← globalSettings.credit_card_pct` (apenas taxa de cartão, conforme escolhido)

Implementação: `useEffect` disparado quando `loading` vira `false`, que aplica os valores apenas se o estado atual ainda estiver em 0 (não sobrescreve um orçamento já carregado com valores próprios — importante para edição de rascunhos salvos).

Isso já reflete automaticamente em:
- `summarize()` → totais de Impostos / Taxas no resumo financeiro
- `UnifiedCart` (cards expandidos) → linhas "Imposto (X%)" e "Taxa cartão (X%)" com valores reais
- Cálculo de Lucro líquido por item

## Arquivo afetado

- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (adiciona o `useEffect` de seed)
