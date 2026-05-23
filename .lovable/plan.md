
# Unificar tudo em "Kit de Produto"

Boa decisão — e a base já existe. O Kit **já tem** o campo `role` com três valores: `required`, `optional`, `alternative`. O que falta é:

1. **Usar de verdade** o `optional` na UI (hoje o motor calcula mas os formulários V3 só renderizam os obrigatórios).
2. **Conectar o Kit aos formulários simples** (Cartão de Visita, Folheto, Banner, Adesivo, Etiqueta) — hoje só Apostila usa Kit (`BookletKitPanel`).
3. **Aposentar** o "Vincular Favoritos" (`product_preset_processes` + `ProductPresetLinksTab`) que criamos recentemente, já que vira redundante.

---

## O que muda na prática

### Em **Insumos → Kits de Produto**

Cada item do kit ganha tratamento visual claro pelo `role`:

- **Obrigatório** (`required`) — entra automático no orçamento, sem botão.
- **Opcional** (`optional`) — aparece como **sugestão clicável** no formulário; só entra no preço se o usuário ativar.
- **Alternativa** (`alternative`) — escolha exclusiva dentro de um grupo (ex.: laminação fosca **ou** brilho, nunca as duas). Já existe via `alternative_group`.

Adicionar 1 campo novo: `default_on` (boolean) — pra "opcional pré-marcado" que o usuário pode desligar (ex.: laminação que normalmente vem, mas dá pra remover).

### Em **Cartão de Visita** (e demais formulários V3)

Hoje `BusinessCardForm` calcula folhas/aproveitamento sozinho e mostra só etapas "fixed/optional" via hook novo.

Vira:
- Carrega o **Kit ativo** do `product_kind = "cartao_visita"` (igual `BookletKitPanel` faz para apostila).
- Passa `units` e `sheets` (já calculados pelo `business-card-yield`) para o motor `buildProductKitRows`.
- Renderiza:
  - Bloco **"Itens incluídos"** (required) — somados ao carrinho automaticamente.
  - Bloco **"Sugestões opcionais"** (optional) — switches; quando ligado, adiciona ao carrinho.
  - Bloco **"Alternativas"** (alternative_group) — radio dentro do grupo.

O cálculo de **quantos cabem na folha** e **quantas folhas** continua igual (motor `business-card-yield`). O Kit só decide o que **acompanha** cada folha/peça.

### Aposentar "Vincular Favoritos"

- Remover aba **"Vincular a Favoritos"** de `ProcessosProducao` (`ProductPresetLinksTab.tsx`).
- Remover hook `useProductPresetProcesses.ts` e helper `lib/orcamentos-v3/product-presets.ts`.
- Migration de **drop**: tabela `product_preset_processes` + colunas relacionadas.
- Limpar import/uso em `BusinessCardForm` (volta a depender só do Kit).

---

## Detalhes técnicos

### Migration
```sql
-- 1) Novo campo no item do kit
ALTER TABLE public.product_kit_items
  ADD COLUMN default_on boolean NOT NULL DEFAULT false;

-- 2) Drop do sistema antigo de vínculo
DROP TABLE IF EXISTS public.product_preset_processes;
```

### Tipos (`productKit.ts`)
```ts
export interface ProductKitItemDB {
  // ...campos existentes
  default_on: boolean;
}
export interface ProductKitRow {
  // ...campos existentes
  defaultOn: boolean;
}
```

`buildProductKitRows` já devolve `role` e `alternativeGroup` — só passar `defaultOn` adiante.

### Componente novo reaproveitável: `KitOptionalsPanel`
Generaliza o que hoje vive em `BookletKitPanel`:
- Props: `kit`, `units`, `sheets`, `supplies`, `steps`, `hourlyRate`, `defaultMarginPct`, `onChange(items)`.
- Render automático de:
  - required → injetado sempre
  - optional → switch (`defaultOn` define estado inicial)
  - alternative_group → radio
- Usado por `BusinessCardForm`, `BookletForm`, `PrintForm`, `LabelEmbeddedForm`, `PrintAndProductForm`.

### Arquivos a remover
- `src/components/orcamentos-v3/admin/ProductPresetLinksTab.tsx`
- `src/components/orcamentos-v3/shared/useProductPresetProcesses.ts`
- `src/lib/orcamentos-v3/product-presets.ts`
- Aba correspondente em `src/pages/ProcessosProducao.tsx`

### Arquivos a editar
- `src/components/orcamentos-v3/shared/productKit.ts` — campo `defaultOn`.
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx` — trocar hook antigo por `KitOptionalsPanel`.
- `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` — extrair lógica genérica pra `KitOptionalsPanel` e renomear apostila pra usá-lo.
- `src/integrations/supabase/types.ts` — regenerado automaticamente pela migration.
- `src/pages/KitsProduto.tsx` (e dialogs em `src/components/kits/`) — adicionar toggle "Pré-marcado" para itens `optional`.

---

## Por que isso é melhor

- **Uma única fonte de verdade**: você cadastra "Cartão de Visita" como Kit, marca Corte como obrigatório, Laminação como opcional, e o sistema responde tanto no preço quanto na UI.
- **Reaproveita motor existente** (`buildProductKitRows`) — sem código duplicado.
- **Mantém o cálculo de aproveitamento de folha** intocado (são responsabilidades diferentes).
- **Remove código novo** que se mostrou redundante (`product_preset_processes`) — sem dívida técnica acumulada.

---

## Risco / atenção

- Quem hoje **não tem Kit cadastrado** para Cartão de Visita verá o formulário sem etapas até criar um. Mitigação: incluir um **seed** simples no migration (Kit "Cartão de Visita Padrão" com Corte = required).
- O `BookletKitPanel` será refatorado — testar que apostila continua calculando espiral por faixa.
