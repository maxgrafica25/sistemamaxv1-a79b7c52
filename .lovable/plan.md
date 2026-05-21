## Objetivo

Quando o usuário clica em **"Aplicar acabamentos"** na aba Apostila do Orçamentos V3, hoje são empurrados 6+ itens separados no carrinho à direita (Apostila, CAPA PP LINE, CAPA PP CAMURCA, Furação, Encadernação, Espiral…). O desejado é mostrar **um único item consolidado**, com nome descritivo agregando a apostila + as principais especificações + os acabamentos aplicados.

Ex.: `Apostila 10× capa padrão + miolo 20fl Sulfite 75g 4x4 cor · espiral 7mm + furação + encadernação`

## Abordagem

Introduzir o conceito de **bundle** (agrupamento visual) no carrinho, sem alterar a lógica de preço/persistência. Os itens continuam existindo individualmente (cada suprimento/mão-de-obra/miolo mantém seu cálculo, margem e snapshot), mas a UI do carrinho colapsa todos os itens do mesmo bundle em uma única linha consolidada — análogo ao que já existe hoje para `tier_group_id` (faixas).

### Mudanças

**1. `src/components/orcamentos-v3/types.ts`**
Adicionar dois campos opcionais comuns a todos os `V3Item`:
- `bundle_id?: string | null` — identificador do agrupamento (gerado uma vez por aplicação do kit).
- `bundle_label?: string | null` — descrição consolidada (preenchida apenas no item "líder" do bundle, normalmente o miolo da apostila).

**2. `src/components/orcamentos-v3/shared/buildBookletBundleLabel.ts` (novo)**
Função `buildBookletBundleLabel({ miolo, kitItems, spiralDiameter, coverMode, backCoverMode })` que retorna algo como:

```
Apostila 10× — miolo 20fl Sulfite 75g 4x4 F/V · capa padrão · contracapa padrão · espiral 7mm · furação · encadernação
```

Regras:
- Cabeça: `Apostila {units}× — miolo {pages}fl {paper_type} {grammage} {cores ou face}`.
- Capa: `capa padrão`, `capa personalizada ({paper})` ou omite se desmarcada.
- Contracapa: idem.
- Demais (espiral/wire-o/furação/encadernação/extras de suprimento): junta pelos `descricao` dos kitItems, com a normalização curta usada em `buildCvDescricao` (remove parênteses, extrai diâmetro do espiral).
- Junta com ` · `, ignora vazios.

**3. `src/components/orcamentos-v3/forms/BookletForm.tsx`**
Em `applyKitItems`:
- Gerar `bundleId = genId()`.
- Setar `bundle_id = bundleId` em **todos** os itens (`miolo` + `kitItems`).
- Setar `bundle_label = buildBookletBundleLabel(...)` **apenas no `miolo`** (líder).
- Continuar chamando `onAddMany(list)` como hoje.

A mesma estratégia se aplica ao `ProductKitPanel` (kit de produto) já existente para manter consistência: aceita o `bundle_id` se vier do consumidor; nesta fase, manter como melhoria futura caso o usuário não peça.

**4. `src/components/orcamentos-v3/cart/UnifiedCart.tsx`**
Ampliar `groupItems()` para agrupar primeiro por `bundle_id` (precedência sobre `tier_group_id`):

- Novo tipo de entry: `{ type: "bundle"; bundleId: string; leader: V3Item; items: V3Item[] }`.
- Renderização: card único com:
  - Ícone do líder (`BookOpen` para apostila).
  - Título = `leader.bundle_label` (ou `leader.descricao` se ausente).
  - Badge `Apostila + Kit (N itens)`.
  - Preço = soma de `priceOf(it).preco_total` para todos os itens do bundle.
  - Botões `Duplicar` (duplica todos os itens preservando um novo bundle_id) e `Excluir` (remove todos os itens do bundle).
- Estado local opcional `expanded` para mostrar/ocultar a lista detalhada (linha por item com preço unitário) — útil para revisão. Começa colapsado.

**5. `NewQuoteFormV3.tsx` (handlers existentes)**
- `onDuplicate` no bundle: percorrer todos os itens do bundle, gerar `newBundleId`, clonar cada um com novo `id` e `bundle_id = newBundleId`, preservando `bundle_label` no líder. Adicionar `useCallback` ou helper `duplicateBundle(bundleId)`.
- `onRemove` no bundle: filtrar items removendo todos cujo `bundle_id` == bundleId.

(Se preferir minimizar mudança na página: o UnifiedCart pode receber `onDuplicate`/`onRemove` recebendo arrays de ids; alternativa é a UnifiedCart chamar `onRemove`/`onDuplicate` em loop por item — funciona com a API atual sem novos props.)

### Não escopo

- **Persistência** (`saveQuoteV3.ts`): não precisa salvar `bundle_id` no banco — é só apresentação do carrinho durante a edição. Se quisermos preservar entre sessões, fica para fase 2.
- **FinancialPanel**: não muda. Continua somando por item (resultado é idêntico).
- **Cliente final / PDF do orçamento**: fora do escopo desta solicitação. (Atualmente segue a lista flat; podemos consolidar no PDF numa próxima rodada.)

### Detalhes técnicos relevantes

- Ordem de prioridade no `groupItems`: `bundle_id` → `tier_group_id` → solo.
- Um item pode ter os dois (bundle + tier) — mas no fluxo da apostila não acontece; tratamos bundle como mais forte.
- O `bundle_label` é recalculado uma única vez no momento do "Aplicar acabamentos" e armazenado; mudanças subsequentes (ex.: editar margem de um suprimento) não regeneram o label — comportamento aceito porque o nome reflete a composição, não os preços.

## Resultado esperado

Antes (6 itens):
```
[Apostila 1× 20fl Sulfite 75g]   R$ 156,00
[CAPA PP LINE A4 0,30 INCOLOR]   R$ 4,00
[CAPA PP CAMURCA A4 0,30 P…]     R$ 4,00
[Furação — preencher]            R$ 0,00
[Encadernação Espiral …]         R$ 2,55
[ESPIRAL INCOLOR 12mm 70 FLS]    R$ 0,70
```

Depois (1 item consolidado, expansível):
```
[📖] Apostila 10× — miolo 20fl Sulfite 75g 4x4 F/V · capa padrão · contracapa padrão · espiral 7mm · furação · encadernação
     Apostila + Kit (6 itens)                                       R$ 167,25
        ▸ ver detalhes
```
