## Reformulação do módulo Orçamentos V2 — padrão Tiny ERP

Objetivo: simplificar o fluxo do vendedor com uma estrutura **linear, tabular e enxuta**, no padrão Tiny ERP. Sai a lógica de "cards expansíveis por impresso" e entra **uma tabela única de linhas de item** com auto-preenchimento por catálogo. Mantém-se toda a engine de pricing (multiplicadores, tiers, snapshot, ancoragem).

### Estrutura visual final (top → bottom)

```text
┌─────────────────────────────────────────────────────────────────┐
│ Proposta Comercial                              Nº 2026-208     │
├─────────────────────────────────────────────────────────────────┤
│ Cliente [busca ▼]   Aos cuidados de [______]   Validade [15] d │
│   ↳ dados do cliente · últimas vendas · contatos                │
├─────────────────────────────────────────────────────────────────┤
│ Introdução / Apresentação                                       │
│ [textarea curta]                                                │
├─────────────────────────────────────────────────────────────────┤
│ ITENS DO ORÇAMENTO                                              │
│ Nº │ Item (busca catálogo)        │ Qtde │ Unit. │ Total │ ⚙   │
│  1 │ [🔍 buscar impresso/CV…]     │ 1000 │  0,42 │  420  │ ⋮   │
│  2 │ [🔍 …]                       │      │       │       │     │
│ + adicionar item    🔍 busca avançada                           │
├─────────────────────────────────────────────────────────────────┤
│ Observações (visíveis no orçamento) [textarea]                  │
├─────────────────────────────────────────────────────────────────┤
│ Outros valores (NÃO aparecem, diluem no total)  R$ [____]       │
│ Frete   [Tipo: Moto ▼]   R$ [____]                              │
├─────────────────────────────────────────────────────────────────┤
│ Condições comerciais                                            │
│   Forma de pagamento [▼ catálogo]   Desconto [R$/%]             │
├─────────────────────────────────────────────────────────────────┤
│ Marcadores [tag] [tag] [+ nova tag]                             │
├─────────────────────────────────────────────────────────────────┤
│ Opções de quantidade (ancoragem) — bloco completo               │
│   [+ adicionar quantidade]                                      │
│   500 un  → unit R$ 0,52  total R$ 260   (+24%)                 │
│   1000 un → unit R$ 0,42  total R$ 420   (base)                 │
│   2000 un → unit R$ 0,35  total R$ 700   (-17%)                 │
├─────────────────────────────────────────────────────────────────┤
│ [Salvar]  [Cancelar]                  Sidebar fixa: Resumo $    │
└─────────────────────────────────────────────────────────────────┘
```

### Mudanças de UX-chave

1. **Tabela única de itens** substitui o `PrintingItemEditor` em card. Cada linha:
   - Coluna "Item": combobox que busca em **printing_price_items + cv_materials** unificado. Ao selecionar, preenche automaticamente unitário pelo catálogo + tier de markup.
   - Qtde editável inline → recalcula unitário (re-tier) sem reabrir editor.
   - Menu `⋮` por linha: editar avançado (paper, gramatura, F/V, cobertura, mão-de-obra interna), duplicar, remover.
   - Linha vazia sempre presente no final ("ghost row" estilo Tiny) — clicar começa a digitar.
2. **"Aos cuidados de"** novo campo livre (string) ao lado do Cliente — para casos B2B onde o orçamento é endereçado a um comprador específico.
3. **Validade inline** (mantém o default global de Configurações, editável).
4. **"Outros valores" oculto** — campo `hidden_extras_value` (numeric). Soma no `totalToCharge` mas **não aparece como linha no PDF/viewer**. Usado para diluir custos comerciais que o vendedor não quer expor.
5. **Frete** com tipo cadastrável:
   - Nova tabela `freight_types` (id, name, default_value, sort_order).
   - Configurações → nova seção "Tipos de frete" para CRUD.
   - No formulário: select do tipo + valor editável.
6. **Marcadores (tags)** livres por orçamento, salvos em `quotes.tags text[]`. Component `TagInput` com sugestões das tags já usadas (autocomplete contra distinct unnest(tags)).
7. **Forma de pagamento** continua, reposicionada na seção "Condições comerciais" junto com desconto.
8. **Ancoragem (bloco completo) no final do formulário** — mantida a UX atual do `QuoteOptionsBuilder` (variant="full"): vendedor adiciona N quantidades e o sistema **recalcula via `recalculateForQuantity`** considerando os itens preenchidos, faixas de markup por volume e diluição de custos fixos. Cada opção mostra unit/total e delta% vs base. Persistido em `quotes.options jsonb`.

### O que NÃO muda

- Engine `recalculateForQuantity`, snapshot, tiers, multiplicadores A3/SRA3/F-V.
- `StickyFinancialSidebar` (custo, margem, valor a cobrar).
- Persistência em `quote_materials` / `quote_labor_steps` / `cv_quote_items` / `quotes.options`.
- Lógica de versões, OP, geração de pedido.
- Permissões (financeiro, isenção de impostos).

### Arquivos afetados (técnico)

- **Migração SQL**:
  - `quotes.attention_to text`
  - `quotes.hidden_extras_value numeric default 0`
  - `quotes.freight_value numeric default 0`, `quotes.freight_type_id uuid`
  - `quotes.tags text[] default '{}'`
  - Nova tabela `freight_types(id, name, default_value, sort_order, created_at)` + RLS (admin gerencia, autenticados leem).
- **Novo componente**: `QuoteItemsTable.tsx` — tabela inline substituindo o bloco atual de `PrintingItemEditor`/`CVItemCard`. Editores avançados acessíveis via Drawer pelo menu `⋮`.
- **Novo componente**: `ui/TagInput.tsx` (chips com autocomplete).
- **Novo componente**: `FreightSelector.tsx` (select tipo + input valor).
- **Refator**: `NewQuoteFormV2.tsx` — JSX reescrito numa única coluna rolável; sidebar financeira continua fixa à direita; `QuoteOptionsBuilder` (variant="full") permanece como **última seção** antes dos botões de salvar.
- **Configurações**: novo `FreightTypesTab.tsx` (ou seção em `CompanyTab.tsx`) para CRUD dos tipos de frete.
- **Pricing**: incluir `hidden_extras_value` e `freight_value` no `totalToCharge` final no `pricing.ts`, somando **após** o markup (não entram na base de cálculo). A ancoragem por quantidade reaplica a mesma soma para cada opção.
- **PDF/Viewer cliente** (`ClientViewer.tsx`, `production-order-pdf.ts`): ocultar `hidden_extras_value`, mostrar frete como linha quando > 0, tags só internamente.

### Migração SQL resumida

```sql
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS attention_to text,
  ADD COLUMN IF NOT EXISTS hidden_extras_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS freight_type_id uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.freight_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  default_value numeric NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.freight_types ENABLE ROW LEVEL SECURITY;
-- policies: SELECT autenticado; INSERT/UPDATE/DELETE admin (has_role)
```

### Decisões implícitas

- **Editor avançado por linha**: mantemos o `PrintingItemEditor` atual reaproveitado num **Drawer** lateral, aberto pelo menu `⋮ → editar avançado`. CV idem com `CVItemCard`.
- **Comunicação Visual**: linhas CV vivem na mesma tabela com badge "CV".
- **"Outros valores"**: aceita negativo (permite desconto oculto). Helper text na UI: "soma ao total final, não aparece no PDF".
- **Ancoragem**: cada opção é recalculada considerando todos os itens da tabela + outros valores + frete, garantindo coerência entre o que o vendedor vê na sidebar e cada faixa de quantidade.
- **Migração de orçamentos antigos**: zero impacto — defaults seguros.

### Resultado esperado

Vendedor abre `/orcamentos-v2/novo`, escolhe cliente, "Aos cuidados de", adiciona itens em uma tabela enxuta (1 linha = 1 produto = 1 preço auto), define observações, frete e outros, escolhe forma de pagamento, marca tags e fecha com o **bloco de ancoragem completo** comparando 3-4 quantidades. Tudo em uma rolagem, com o resumo financeiro sempre visível na sidebar.
