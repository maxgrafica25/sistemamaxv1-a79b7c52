# Faixas de preço por quantidade no Orçamentos V3

## Problema
Cliente gráfico quase sempre pede "me dá o preço para 100, 250, 500 e 1000". Hoje o V3 calcula 1 quantidade por item; para simular faixas o usuário precisa duplicar o item N vezes manualmente, refazer cada cálculo e remontar o PDF.

## Estratégia recomendada (em 2 camadas)

A solução mais ágil mistura **simulação rápida** (durante a montagem do item) com **persistência opcional** (quando o usuário quer enviar as faixas no orçamento final). Ambas usam as engines de pricing que já existem (`priceOf`, engine CV, etc.) — não há lógica nova de negócio, só re-execução com `quantidade` diferente.

### Camada 1 — "Simulador de faixas" (inline, não persistido)
Um painel **"Comparar faixas"** dentro de cada form de item (Print, CV, Booklet, Label, Third, Supply). 

- Botão `📊 Comparar faixas` ao lado de "Quantidade".
- Abre um popover/drawer com uma tabelinha editável de quantidades (default: `100, 250, 500, 1000`, mas o usuário pode editar/adicionar/remover livremente, ou clicar em presets `+50%`, `×2`, `×5`).
- Para cada linha, roda a engine de pricing com aquela quantidade e mostra:
  - Qtd · Custo total · Preço total · **Preço unitário** · Δ% vs faixa anterior
- Cada linha tem um botão **"Usar esta"** (substitui `quantidade` no item atual) e **"Adicionar ao orçamento"** (duplica o item com aquela qtd, ver Camada 2).
- Atualiza em tempo real conforme o usuário muda mídia/acabamentos/papel — é só `useMemo` rodando `priceOf` com cada qtd.

**Por que assim:** zero impacto no schema, zero risco no PDF/ERP, e resolve 80% dos casos (cliente pergunta no WhatsApp, vendedor responde os 4 preços em 5 segundos).

### Camada 2 — "Faixas no orçamento" (persistido, vai pro PDF)
Quando o cliente realmente quer ver as faixas no PDF do orçamento:

- Botão **"Adicionar como faixas"** no simulador → cria N itens irmãos no carrinho, marcados com um `tier_group_id` comum.
- No `UnifiedCart`, itens do mesmo grupo aparecem agrupados visualmente (um card só com sub-linhas "100un · R$ X · R$ Y/un").
- No PDF/cliente viewer, renderiza como tabela de faixas (1 produto, N preços) em vez de N produtos separados.
- Atualizar a descrição de um item do grupo propaga para os irmãos (mesmo produto, só muda qtd).

**Por que separar das Camada 1:** muita gente só quer o número rápido — não polui o carrinho. Quem precisa do PDF formal usa "Adicionar como faixas".

## Detalhes técnicos

**Tipos** (`types.ts`):
```ts
interface V3ItemBase {
  tier_group_id?: string | null; // novo, opcional
}
```
Adicionar em todos os `V3*Item`. Default null = comportamento atual.

**Simulador** (`shared/TierSimulator.tsx`, novo):
- Props: `item: V3Item`, `onPickQty(qty)`, `onCloneAs(qtys: number[])`
- Usa `priceOf({ ...item, quantidade: q })` para cada qty da lista.
- Para CV com snapshot, recalcula via engine ao invés do snapshot (snapshot é por qtd).
- Memoização agressiva.

**Forms**: cada `*Form.tsx` ganha um `<TierSimulatorButton item={draft}/>` ao lado do campo Quantidade. Sem mudança nos handlers de submit.

**Cart**: `UnifiedCart` agrupa por `tier_group_id` ao renderizar. `saveQuoteV3` apenas persiste o campo extra; os itens continuam linhas independentes no DB.

**PDF/Viewer**: ajustar `ClientViewer` e o gerador de PDF para colapsar grupos em uma tabela de faixas.

**Defaults configuráveis**: salvar em `localStorage` as faixas padrão do usuário (ex: gráfica de etiqueta usa `1k, 5k, 10k`; gráfica offset usa `100, 250, 500`).

## Fora de escopo
- Descontos automáticos por faixa (cliente assina contrato com tabela): isso é outro feature.
- Tiers no catálogo de Print já existem (`markup_tiers`) — eles continuam aplicando a regra por dentro do `priceOf`, esta feature é ortogonal.
- Edição em massa de margem por faixa (pode vir depois se necessário).

## Entrega sugerida em fases
1. **Fase A (rápida, alto valor):** só a Camada 1 (simulador inline) em Print, CV e Label. ~1 PR.
2. **Fase B:** estender simulador para Booklet/Supply/Third/Labor.
3. **Fase C:** Camada 2 (tier_group_id, agrupamento no carrinho, PDF de faixas).

Quer que eu siga com a **Fase A** já?
