
# Opções de quantidade — fluxo completo

Objetivo: tornar trivial criar variações de quantidade de um orçamento (incluindo CV e acabamentos) e fácil para o cliente comparar, com a melhor opção em destaque.

---

## 1. Cadastro (tela do usuário interno)

Reformular o bloco `QuoteOptionsBuilder` (variante `chips`, que é a usada hoje no formulário):

- **Linha de atalhos automáticos**: 4 chips clicáveis baseados na quantidade base do orçamento (a soma dos itens de impressão + CV):
  - **½×** (metade, arredondado p/ múltiplo "limpo")
  - **2×**
  - **3×**
  - **5×**
  - Clique = adiciona/remove instantaneamente. Chip fica "preenchido" quando ativo.
- **Arredondamento inteligente** das sugestões: 50/100/250/500/1000/2500/5000 conforme a escala (ex.: base 80 → ½×=50, 2×=150, 3×=250, 5×=500).
- **Campo livre** abaixo dos chips, para quantidade personalizada (mantém o input atual mas em estilo mais discreto).
- **Lista das opções ativas** com preço unitário + total + Δ% vs base, removível com X.
- Mensagem vazio: "Adicione com 1 clique nos atalhos abaixo".

## 2. Motor de recálculo

Hoje `recalculateForQuantity` cobre só itens de impressão (snapshot do printing engine). Precisamos estender para que cada opção reflita o orçamento inteiro.

Criar `recalculateQuoteForQuantity(snapshot, cvItems, baseQty, newQty)` em `src/lib/quotes-v2/options-pricing.ts`:

1. **Impressão**: chamar `recalculateForQuantity` (já existente — aplica tier correto + dilui setup).
2. **CV (Comunicação Visual)**: para cada `CVItemState`, rodar `calcularItemCV` com `quantidade` proporcional `Math.round(cv.quantidade * newQty/baseQty)` (mínimo 1). Isso reescala automaticamente mídia, impressão e **acabamentos** (m²/perímetro/unidade) porque o engine de CV já é puro.
3. **Frete, descontos, taxas**: aplicar exatamente a mesma lógica do total atual em cima do novo subtotal.
4. **Arredondar para cima** ao múltiplo de R$ 0,10 (regra global).

Retornar `{ unitPrice, total, breakdown }` para cada opção e gravar em `quote.options` (formato já existente em `options.ts`).

## 3. Visão do cliente (`ClientViewer`)

Refinar o bloco "Outras quantidades para comparar":

- **Grid de cards** (≥2 colunas em desktop, stack em mobile) — `OptionCard`.
- **Destaque automático** "💡 Melhor custo-benefício" na opção com **menor preço unitário** (geralmente a de maior volume) — badge no canto + borda primária mais forte.
- Cada card mostra: Quantidade, Total grande, "R$ X,XX / un", e uma **linha de economia** comparando com a menor opção ("economiza 18% por unidade").
- Manter o modo seletivo (`showOptionsMode`) intacto quando o orçamento foi criado com opções selecionáveis.
- **Não** adicionar campo para o cliente pedir outra quantidade (decisão sua).

## 4. Detalhes técnicos

Arquivos afetados:

- `src/components/orcamentos-v2/QuoteOptionsBuilder.tsx` — reescrever variante `chips` com atalhos.
- `src/lib/quotes-v2/options-pricing.ts` *(novo)* — função `recalculateQuoteForQuantity` envolvendo printing + CV.
- `src/lib/quotes-v2/options.ts` — adicionar `breakdown?: { printing: number; cv: number; finishing: number }` opcional para mostrar no card admin (não obrigatório no DB).
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — passar `cvItems` + `baseQuantity` para o builder; usar a nova função no `recalculateForQuantity` atual.
- `src/components/orcamentos-v2/client-viewer/OptionCard.tsx` — adicionar prop `isBest` + linha de economia vs base.
- `src/pages/orcamentos-v2/ClientViewer.tsx` — calcular qual opção é a "melhor" (menor unit_price) e ordenar por quantidade crescente.

Sem migrations: o campo `quotes.options` (jsonb) já suporta o formato existente.

## 5. Fora de escopo

- Não permitir cliente solicitar quantidade fora das opções (decisão sua).
- Não mudar o motor de impressão nem o de CV — apenas orquestrar chamadas.
- Não mexer em PDF de orçamento nesta etapa (segue exibindo o `quote.value` da base).
