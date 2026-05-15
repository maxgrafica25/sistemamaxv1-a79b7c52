# Mostrar o papel "real" vinculado ao item de impressão

## Contexto

Hoje, ao buscar um item no orçamento (ex.: "Sulfite 75g — A4 F/V · Xerox C70"), o seletor mostra apenas o que está cadastrado no **Catálogo de Preço de Impressão**. O papel da **Matérias-Primas** que dá origem ao custo (`paper_cost`) fica invisível — você não consegue saber se a Sulfite 75g sendo usada é a "caixa Suzano 5.000fl" ou um pacote avulso de 500fl.

Importante: hoje **não existe FK** entre `printing_price_items` e `papers`. O vínculo é implícito por **nome + gramatura** (já é assim que a função "Sincronizar custos" funciona em PrecoImpressao, linha 553-554). Não vamos mudar isso — vamos só **expor visualmente** esse vínculo nos lugares onde o usuário escolhe o item.

## O que muda (apenas UI)

### 1. Resolver o papel vinculado client-side

Helper puro: dado um `PrintingCatalogItem` e a lista de `papers` (já carregada no `NewQuoteFormV2`), retornar a primeira `papers` row em que `normalize(name) === normalize(paper_type)` **e** (gramatura vazia em algum dos lados ou `grammage` igual). Mesma regra usada pela sincronização de custos. Se houver múltiplos matches (ex.: Sulfite 75g 75x105 + Sulfite 75g A4), preferir o que tem `is_cut_size = true` quando o item do catálogo é cortado, e o folhão caso contrário.

Retorna `{ id, name, grammage, sheet_label, unit_cost }` onde `sheet_label` é algo como `"Caixa 5.000fl"` ou `"Pacote 500fl"` (derivado de `sheet_qty` da papers row, sem mudança de schema).

### 2. Linha extra no resultado da busca

Em **`PrintingItemSearch`** e no **picker inline do PrintingItemEditor** (mesmo dropdown), abaixo da linha já existente `Categoria · Equipamento · Tier`, adicionar uma terceira linha pequena:

```text
Sulfite 75g — A4 F/V                              R$ 0,42/folha
Produção · Xerox C70 · 250–500
↳ vinculado a: Sulfite 75g 75×105 · Caixa 5.000fl  R$ 0,4474/fl
```

Estilo: `text-[10px] text-muted-foreground` com um ícone `Link2` de 10px. Se nenhum papel for encontrado em Matérias-Primas, mostrar `↳ sem papel vinculado` em `text-warning` para sinalizar inconsistência.

### 3. Após selecionar o item

O badge atual no `PrintingItemEditor` (que mostra `paperType grammage — size side` selecionado) ganha, embaixo, a mesma linha `↳ vinculado a: …` para que o vínculo continue visível enquanto o orçamento é editado.

## Fora de escopo

- **Sem migração de banco** — não adiciono `paper_id` em `printing_price_items` nessa rodada. O vínculo continua por nome+gramatura.
- Não muda cálculo de preço, frete, ou sincronização de custos.
- Não mexe em Suprimentos, Acabamentos, ou Pedidos.
- Não toca no diálogo de cadastro do Catálogo de Preço de Impressão.

## Detalhes técnicos

- Novo helper `src/lib/quotes-v2/linked-paper.ts` exportando `resolveLinkedPaper(catalogItem, papers)` e `formatLinkedPaperLabel(paper)`.
- `NewQuoteFormV2` já carrega `papers` (linha ~197 de PrecoImpressao usa o mesmo padrão); confirmar que está disponível ou adicionar 1 fetch e passar via prop `papers` para `PrintingItemEditor` e `PrintingItemSearch`.
- `PrintingItemSearch.tsx`: adicionar prop opcional `papers?: PaperRow[]` e renderizar a linha extra dentro do `<button>` de cada resultado.
- `PrintingItemEditor.tsx`: passar `papers` para os 2 dropdowns inline (linhas ~604-651 e ~1098-1127) e mostrar a linha `↳ vinculado a:` no badge do papel selecionado (linha ~567 e ~1049).
- Sem novos estados, sem mudança de schema, sem mudança de tipos do Supabase.

## Pergunta rápida antes de implementar

Para o caso "Sulfite 75g" existir em Matérias-Primas como 2 entradas (uma `75×105` folhão e outra `A4` cortada), prefere que o seletor:

(a) escolha automaticamente pela regra `is_cut_size` (cortado → cortado; folhão → folhão), ou
(b) mostre as 2 opções vinculadas separadamente no `↳`?

Default sugerido: **(a)**, mais limpo visualmente.
