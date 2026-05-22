## Novo formato dos itens no carrinho lateral

Substituir o cabeçalho atual de cada item por um padrão consistente, focado em quantidade e detalhes de produção.

### Novo padrão visual

**Título (linha 1):** `{qty} un. - {Nome do Produto}`
- Exemplo: `1 un. - Apostila`
- Negrito, mesmo tamanho atual (`text-[13px]`)

**Subtítulo (linha 2):** detalhes de produção em cinza (`text-muted-foreground`), fonte menor (`text-[11px]`), separados por `|`. Para evitar redundância com o título, a quantidade principal NÃO se repete no subtítulo de Etiqueta/Terceiro/Suprimento.

- Print: `{qty} folhas | {Papel} {gramatura}g | {Frente | Frente/Verso}` (qty = folhas do miolo)
- Apostila (booklet): `{bookletPages} folhas | {Papel} {gramatura}g | {Frente | Frente/Verso}` (folhas por apostila, não kits)
- Etiqueta: `{labelW}×{labelH} mm | {Papel} {gramatura}g`
- CV: `{largura}×{altura} cm | {Mídia} | {Impressão}`
- Terceiro: `{Fornecedor}`
- Suprimento: `{Suprimento}`
- Mão-de-obra: `{tempo} min | {Etapa}`

Exemplo final: `20 folhas | Sulfite 75g | Frente/Verso`

### Remoção do "1x"

- Em `cartMeta` (apostila), substituir `${bookletUnits}× ${bookletPages}fl` pelo novo subtítulo descrito acima — sem o caractere `×` antes da quantidade.
- O caractere `×` permanece apenas em dimensões físicas (ex: `50×50 mm`, `30×40 cm`), onde representa medida — sem ambiguidade com cores.

### Onde aplicar (arquivo: `src/components/orcamentos-v3/cart/UnifiedCart.tsx`)

1. **`SingleCard`** (linhas 488-548):
   - Substituir o `<p>` do título por `{qty} un. - {nome}`.
   - Substituir o bloco `Badge + cartMeta` por um único `<p>` em cinza com o novo subtítulo.
   - Manter o preço à direita, o botão "detalhes/ocultar" e as ações (duplicar/excluir).

2. **Group/Tier card** (linhas 352-383):
   - Cabeçalho do grupo passa a usar `{primaryQty} un. - {descricao}` no título.
   - Adicionar subtítulo cinza com os detalhes do `primaryItem`.
   - Linhas de faixas (tiers) permanecem inalteradas (já mostram "X un · valor").

3. **`BundleCard`** (linhas 396-479):
   - Cabeçalho passa a `{leaderQty} un. - {title}`.
   - Adicionar subtítulo cinza com os detalhes do `leader`.
   - Botão "ver detalhes" e itens internos permanecem.

4. **Helper novo** `itemSubtitle(it: V3Item): string` — concentra a construção do subtítulo por `kind`, retornando string já formatada com `|`. Reaproveitado nos 3 cards.

5. **`cartMeta`** pode ser removida (ou deixada apenas como fallback) — não será mais usada nos cards após a refatoração.

### Escopo

- Apenas visual/apresentação. Sem alterações em tipos, pricing, lógica de tiers, persistência ou detalhes expandidos (`itemDetails`).