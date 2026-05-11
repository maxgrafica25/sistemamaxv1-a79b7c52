## Modo Apostila no editor de impressão

Quando o **Tipo de Material** for "Apostila(s)", o `PrintingItemEditor` muda de comportamento — sem mexer em `pricing.ts`, schema do banco ou nos demais tipos de produto.

### 1. Detecção
Em `PrintingItemEditor.tsx`, adicionar helper `isApostilaKind(kind)` (igual ao `isLabelKind` existente) que casa com "apostila"/"apostilas".

### 2. UI condicional (quando apostila) — dimensões livres
- **Mantém** os campos `Largura (cm)` e `Altura (cm)` visíveis e editáveis. Default sugerido (placeholder): `21` × `29,7` (A4), mas o usuário pode digitar `14,8` × `21` para A5, ou qualquer outro formato.
- O **catálogo de papéis** continua sem filtro extra de tamanho (mostra A4, A3, SRA3 normalmente). O usuário escolhe o papel adequado ao formato.
- `calcSheetYield` continua funcionando normalmente sobre `widthMm/heightMm` — para apostila A5 em folha A4 ele já vai render 2 páginas/folha, e essa otimização entra no preço.
- **Substitui** o campo "Peças desejadas" por dois campos lado a lado:
  - **Nº de páginas** (por apostila)
  - **Nº de apostilas**
- **Toggle "Frente e verso"** (default: ligado). Quando ligado, divide páginas por 2 (arredondando para cima).
- Cor da Impressão segue disponível; o `side` do papel é forçado para `F/V` quando o toggle está ligado e `Simples` quando desligado.

### 3. Cálculo de folhas/peças
```text
folhasPorApostila = ceil(paginas / (frenteEVerso ? 2 : 1))
totalPaginasFisicas = folhasPorApostila × nApostilas   // = "peças desejadas"
pieces            = totalPaginasFisicas
quantity          = ceil(pieces / yieldInfo.perSheet)  // folhas faturadas (já existe esse sync)
```

Reaproveitamos o `useEffect` que já sincroniza `quantity` a partir de `pieces` e `perSheet`. Para apostilas, apenas alimentamos `pieces` a partir de `paginas × apostilas / (F/V?2:1)`.

### 4. Capa + contracapa (sub-itens automáticos)
Abaixo do papel do miolo, quando o tipo é apostila, aparecem dois selects compactos:
- **Papel da Capa** (autocomplete do mesmo catálogo) — opcional
- **Papel da Contracapa** (idem) — opcional, com botão "igual à capa"

Ao escolher, o componente cria/atualiza materiais filhos vinculados (`parentItemId = id do item apostila`) com:
- `quantity = nApostilas` (1 folha de capa por apostila — `pieces` também = nApostilas; `quantity` recalculado por `calcSheetYield` se a capa couber 2/folha A4)
- `baseCost = custo da folha do catálogo escolhido`
- `printerCategoryId/markupGroupId = do papel escolhido`
- `productKind = "Capa"` / `"Contracapa"`

O motor de pricing existente já dilui esses custos no preço unitário do item pai (lógica V2 reestruturada). Trocar o tipo para algo diferente de apostila remove os filhos automáticos.

### 5. Encadernação — via chip do SmartFinishingBlock
**Não** abrir `ProcessPicker` nem modal. Em `src/lib/quotes-v2/finishing-suggestions.ts`, adicionar uma nova regra:

```ts
{ match: /apostila/i, suggest: ["Encadernação espiral", "Encadernação", "Refile"] },
```

`getFinishingSuggestions` já resolve cada label contra `processSteps` (substring case-insensitive na descrição). Se o vendedor cadastrou um processo "Encadernação espiral" com valor da molinha + tempo embutidos, o chip cai pronto com `step` e adiciona como labor com tempo correto. Se ainda não existe, vira chip "custom" criando uma linha avulsa de 0 min para o usuário ajustar.

A quantidade da encadernação é responsabilidade do processo cadastrado (tempo por unidade × `nApostilas`). Para refletir a quantidade no preço, o `SmartFinishingBlock` adiciona como `SubformLabor` com `timeMinutes = step.time_minutes`. Como o tempo de encadernação no cadastro é por unidade, multiplicamos por `nApostilas` no momento da inclusão automática **apenas para o chip "Encadernação"/"Encadernação espiral" quando productKind for apostila** (regra mínima dentro do handler do chip; sem mudar o engine).

### 6. Título dinâmico
Estender `buildDynamicTitle` em `src/lib/quotes-v2/item-title.ts` para acrescentar sufixo "· N págs × M un" quando `productKind` for apostila. Ex.:
> "Apostila 14,8x21cm 4x4 F/V — Sulfite 75g · 50 págs × 10 un"

### 7. Persistência
Migração leve em `quote_materials`:

```sql
ALTER TABLE quote_materials
  ADD COLUMN booklet_pages integer,
  ADD COLUMN booklet_units integer,
  ADD COLUMN booklet_duplex boolean;
```

Sem isso, ao reabrir o orçamento perdemos os valores originais (só sobra `pieces` calculado).

### Arquivos afetados
- `src/components/orcamentos-v2/PrintingItemEditor.tsx` — UI condicional (páginas/apostilas/F-V), capa/contracapa
- `src/lib/quotes-v2/finishing-suggestions.ts` — regra para "apostila" (chip de encadernação)
- `src/components/orcamentos-v2/SmartFinishingBlock.tsx` — multiplicar `timeMinutes` por `nApostilas` no clique do chip de encadernação quando produto for apostila
- `src/lib/quotes-v2/item-title.ts` — sufixo "· N págs × M un"
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — passagem dos novos campos para filhos automáticos
- Migração: 3 colunas em `quote_materials`

### Fora do escopo
- Mudanças no engine de pricing (`pricing.ts`)
- Cadastro automático de processo de encadernação no banco
- ProcessPicker (não usado neste fluxo)
