## Problema
Hoje o "+ adicionar item" abre menu em cascata (Impressão / Acabamento › Etapa › Grupo › Linha em branco) + dialogs separados de busca. Muitos cliques e nada parecido com o fluxo de uma linha do Tiny.

Além disso, processos/acabamentos avulsos hoje aceitam **descrição livre** (`Input` em `renderLabor` e `renderMaterial` em `QuoteItemsTable.tsx`), o que permite cada vendedor escrever o mesmo serviço de forma diferente.

## 1. Nova UX da tabela de itens (estilo Tiny)

**Comportamento do botão:**
- `+ adicionar item` passa a ter **uma única ação**: insere uma linha "rascunho" (`draft`) no fim da tabela. Sem dropdown, sem submenus.
- Removo também os atalhos "buscar impressão" e "buscar etapa/grupo" da barra inferior — toda a entrada acontece dentro da própria linha.

**Anatomia da nova linha (substitui a coluna "Tipo + Item"):**

```text
Nº | [Tipo ▾] | [🔍 buscar item ...........] [+ acab.] | Qtde | UN | Preço un. | Total | x
```

1. **Coluna Tipo** — `Select` com 3 opções: `Impressão`, `Acabamento`, `Impressão + Acabamento`. Default vazio; ao escolher, troca o tipo do search inline.
2. **Coluna Item** — `Combobox` (cmdk) inline, **sem Dialog**:
   - `Impressão` → busca em `printing_price_items` (catálogo já carregado em `printingCatalog`).
   - `Acabamento` → busca em `finishings_price_items` (novo fetch no `loadInit`).
   - `Impressão + Acabamento` → primeiro seleciona impressão; após selecionado a linha ganha um pill `[+ acabamento]` que abre um popover com multi-select dos `finishings_price_items` compatíveis. Cada acabamento vira sub-item filho (`parent_item_id` apontando para o material da impressão — coluna já existe em `quote_materials`).
3. Enquanto a linha está em modo `draft` (sem item escolhido), Qtde/Preço ficam desabilitados. Ao escolher um item, ela vira uma linha normal (vai para `materials` no estado, igual hoje em `onAddPrinting`).
4. **Linhas legadas** ("Material" livre, "Serviço" terceirizado) continuam editáveis para retro-compat, mas deixam de ser **criáveis** — não há entrada de UI nova para elas.

**Sem modais.** Todo o fluxo acontece em uma linha, com popover apenas para a lista de acabamentos do combo. Mantemos `PrintingItemSearch` mas embarcado no popover do combobox da linha (não mais em `Dialog`).

## 2. Padronização de nomenclatura (DB + UI)

**Princípio:** nenhum campo de texto livre para "nome do produto/serviço" no orçamento. O usuário **só seleciona** de catálogos travados.

### Catálogos canônicos (já existem)
- `printing_price_items` — itens de impressão (papel + tamanho + lado + impressora).
- `finishings_price_items` — acabamentos (laminação, corte, vinco, dobra, etc.).
- `production_steps` — etapas de produção (mão de obra padronizada, opcional para uso interno).

Todos têm `name`/`description` já definidos pelo admin. O orçamento sempre referencia por `id`.

### Mudanças no schema
Migração para reforçar a integridade:

1. Adicionar colunas em `quote_materials`:
   - `catalog_source text` — `'printing'` | `'finishing'` | `null`
   - `catalog_item_id uuid` — id do item no catálogo de origem
   - `parent_item_id` já existe (usado para vincular acabamento → impressão).
2. Trigger `BEFORE INSERT OR UPDATE` em `quote_materials`:
   - Se `catalog_source = 'printing'` → exigir que `catalog_item_id` exista em `printing_price_items`.
   - Se `catalog_source = 'finishing'` → idem em `finishings_price_items` **e** exigir `parent_item_id NOT NULL` apontando para um material `printing` do mesmo `quote_id`.
   - O `description` é **sempre sobrescrito** com o `name` canônico do catálogo (via trigger), garantindo que mesmo se o front mandar um texto diferente, o banco grava o nome oficial.
3. Índice único parcial em `printing_price_items(lower(name))` e `finishings_price_items(lower(name))` para impedir o admin de cadastrar duplicados (`Adesivo Vinil` vs `Vinil Adesivo` — quem cadastra é só o admin, então o controle fica em uma única mão).
4. Linhas legadas continuam permitidas (`catalog_source IS NULL`) só para não quebrar orçamentos antigos; nenhum input novo cria esse caso.

### No front
- O `Combobox` da linha só emite `onSelect(item)` com `id` do catálogo — nunca aceita texto livre.
- Remover o `<Input value={l.description}>` do `renderLabor` e `<Input value={m.description}>` do `renderMaterial`. Esses campos ficam read-only mostrando o nome vindo do catálogo.
- "Não achei o que preciso" → botão `+ cadastrar no catálogo` visível apenas para admins (`useIsAdmin`), abrindo o cadastro normal de `printing_price_items` ou `finishings_price_items`. Vendedor comum não cria item.

### Por que isso resolve "Adesivo Vinil" vs "Vinil Adesivo"
- O vendedor não digita: ele busca. A busca lista exatamente as N opções cadastradas pelo admin.
- O `description` salvo no orçamento vem do `catalog_item_id` via trigger, não do que o front mandou.
- O índice único impede o próprio admin de cadastrar duas variações do mesmo nome.
- Resultado: 1 item no catálogo = 1 nome = 1 forma de aparecer em todos os orçamentos.

## Arquivos afetados
- `src/components/orcamentos-v2/QuoteItemsTable.tsx` — refatorar `+ adicionar item`, criar `<DraftRow>` com Tipo + Combobox inline + popover de acabamentos. Remover Dialog de busca.
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — carregar `finishings_price_items` no `loadInit`; adicionar handler `onAddFinishing(parentId, finishingItem)`.
- Novo arquivo `src/components/orcamentos-v2/InlineItemCombobox.tsx` — combobox cmdk que recebe `mode: "printing" | "finishing"` + lista.
- Migração SQL: colunas `catalog_source` / `catalog_item_id` em `quote_materials`, trigger de validação/normalização, índices únicos nos catálogos.

## Fora do escopo (avisar)
- Não toco no fluxo Comunicação Visual (`CVItemCard`) — ele já tem catálogo próprio (`cv_materials`/`cv_printers`) sem texto livre.
- Não migro orçamentos antigos com `description` divergente — só passam a ser obrigatoriamente canônicos os itens criados/atualizados depois da migração.

Aprovar para eu implementar?