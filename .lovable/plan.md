# Acabamentos CV no padrão de impressão (com chips "Sugeridos")

## O que muda

Hoje, em cada peça de Comunicação Visual, os acabamentos são adicionados via um único botão "Adicionar" que abre um Popover-lista. Não há sugestão contextual nem busca.

A proposta é replicar o padrão já usado em **impressão** (`SmartFinishingBlock`):

1. **Chips "Sugeridos"** no topo — botões pequenos com `Plus + nome`, em pílulas tracejadas com cor primária. Aparecem só os mais comuns para a mídia selecionada e que ainda não foram adicionados.
2. **Omnibox de busca** ("Buscar ou criar novo acabamento…") — filtra a lista completa de acabamentos compatíveis com a mídia, e dá a opção de criar acabamento avulso quando nada corresponde.
3. **Botão "Acabamento avulso"** mantém-se acessível como atalho secundário (ou via "Criar 'xyz'" no omnibox, como no padrão de impressão).
4. Lista de acabamentos aplicados continua igual abaixo.

## Lógica de "Sugeridos" para CV

Como CV não tem `productKind`/`processSteps`, a sugestão vem da **mídia** selecionada:

- **Lona** → Bainha, Ilhós, Bastão (Banner Bastão).
- **Adesivo** → Corte (recorte/contorno), Laminação.
- **Banner** → Bainha, Ilhós, Bastão.
- **Outros (papel, tecido…)** → primeiros 3 acabamentos compatíveis ordenados por `sort_order` por mídia.

Implementação: novo helper `getCvFinishingSuggestions(tipo, acabamentos, applied)` em `src/lib/quotes-v2/cv-finishing-suggestions.ts`. Casa por `familia` (`bainha`, `ilhos`, `banner_bastao`, `corte`, `laminacao`) com fallback para os top-3 compatíveis.

- Esconde sugestões já aplicadas (`applied` contém os `finish_id`).
- Esconde sugestões cuja `familia` não exista no catálogo da empresa.
- Se nada sugerido sobrar, oculta a faixa inteira (igual ao SmartFinishingBlock).

## Estrutura visual (espelhando SmartFinishingBlock)

````text
Acabamentos
[ Sparkles ] SUGERIDOS   [+ Bainha] [+ Ilhós] [+ Bastão]

[ 🔎 Buscar ou criar novo acabamento…              ]

— lista de acabamentos aplicados —
[ Bainha            qtd: 1   R$ 12,00   x ]
[ Ilhós             qtd: 4   R$ 8,00    x ]
````

- Chips: `rounded-full border-dashed border-primary/40 bg-primary/5 text-primary` (mesmas classes).
- Omnibox: `Popover + Command` filtrando `compatAcabamentos`. Item "Criar avulso" no topo quando há query sem match.
- Sem mídia selecionada → mostrar texto "Selecione a mídia para ver acabamentos" no lugar dos sugeridos/busca (atualmente o botão fica `disabled`).

## Arquivos afetados

- `src/components/orcamentos-v2/CVItemCard.tsx` — substituir o bloco "Acabamentos" (linhas ~332-422) pelo novo padrão: faixa de chips Sugeridos + omnibox + atalho avulso. Manter `addAcabamento`, `removeAcabamento`, `addCustomAcabamento`.
- `src/lib/quotes-v2/cv-finishing-suggestions.ts` — **novo**. Exporta `getCvFinishingSuggestions(tipo, acabamentos)` retornando `Array<{ acabamento: Acabamento; label: string }>`.

## Não muda

- Engine de cálculo CV, persistência (`finishes_json`), badges de família/bastão automático, controles de quantidade unidade-based.
- Padrão dos acabamentos em impressão (`SmartFinishingBlock`) permanece intocado.
