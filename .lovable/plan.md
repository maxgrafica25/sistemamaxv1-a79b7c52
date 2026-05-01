# Reestruturação do Wizard de Orçamentos V2 (6 → 4 etapas) — Plano Final

Decisões confirmadas com o usuário marcadas com ✅.

---

## Objetivo

Reduzir cliques e dar contexto ao orçamento, permitindo que **mão de obra** e **materiais manuais** sejam vinculados a cada **item de impressão** específico. A estrutura de abas é mantida, mas reorganizada em **4 etapas**: Informações → Itens do Orçamento → Terceirizados → Finalizar.

A mudança é principalmente de UX e modelo de dados — engines de cálculo continuam puros, apenas ganham o conceito de "diluição por item pai".

---

## Mudanças no Banco (1 migration)

```sql
-- 1. Vínculo de filhos ao item de impressão pai
ALTER TABLE quote_materials   ADD COLUMN parent_item_id uuid NULL
  REFERENCES quote_materials(id) ON DELETE CASCADE;
ALTER TABLE quote_labor_steps ADD COLUMN parent_item_id uuid NULL
  REFERENCES quote_materials(id) ON DELETE CASCADE;

CREATE INDEX idx_quote_materials_parent   ON quote_materials(parent_item_id);
CREATE INDEX idx_quote_labor_steps_parent ON quote_labor_steps(parent_item_id);

-- 2. Observações gerais do orçamento ✅
ALTER TABLE quotes ADD COLUMN notes text NULL;
```

Regras:
- `parent_item_id IS NULL` → item **avulso** (comportamento atual, retrocompatível).
- `parent_item_id` preenchido → filho de um item de impressão (sempre `quote_materials` com `baseCost`/`printer_category_id`).
- Cascata: deletar pai apaga filhos automaticamente.

`quote_third_party` e RLS permanecem como hoje.

---

## Reestruturação do Wizard (`NewQuoteFormV2.tsx`)

### 4 Etapas

1. **Informações** — Nº, Cliente, Produto/Serviço, Validade, Margem %, **+ "Observações Gerais"** (textarea) ✅.
2. **Itens do Orçamento** — consolida Mão de Obra + Materiais + CV em 3 blocos.
3. **Terceirizados** — sem mudança.
4. **Finalizar** — Desconto, forma de pagamento, ancoragem, salvar, link público.

### Etapa 2 — Estrutura visual ✅ (ordem confirmada)

```text
┌─ Bloco 1: Itens de Impressão ──────────────────────┐
│  [+ Adicionar Item de Impressão]                   │
│                                                    │
│  ▸ Cartão Couché 300g A4 F/V — 1000 un  R$ 1.200  │
│      └─ Acabamentos vinculados:                    │
│         • M.Obra: Corte (15min)       R$ 20        │
│         • Material: Verniz UV (×1)    R$ 35        │
│         [+ M.Obra] [+ Material] [+ Importar grupo] │
│                                                    │
│  ▸ Folder A3 4x4 — 500 un  R$ 2.400               │
└────────────────────────────────────────────────────┘

┌─ Bloco 2: Itens de Comunicação Visual ─────────────┐
│  [+ Adicionar Item CV]  → CVItemCard               │
└────────────────────────────────────────────────────┘

┌─ Bloco 3: Avulsos (não vinculados) ────────────────┐
│  [+ M.Obra Avulsa] [+ Material Avulso] [+ Grupo]   │
│  • Setup geral (30min)        R$ 40                │
│  • Caixa de transporte ×1     R$ 15                │
└────────────────────────────────────────────────────┘
```

### Novos componentes

- **`PrintingItemEditor.tsx`** — Card por item de impressão. Topo: `PrintingItemSearch` para escolher do catálogo + qty. Embaixo: área "Acabamentos vinculados" usando `LaborAndSupplySubform` filtrado por `parentItemId === item.id`.
- **`LaborAndSupplySubform.tsx`** — Mini-lista compacta (descrição + min/qty + custo + remover). Recebe `parentItemId?: string | null` e usa em todas as inserções.

Importação de grupo ✅: `LoadFromGroupDialog` ganha prop opcional `parentItemId`. Quando chamado dentro de um item de impressão, todos os itens importados herdam aquele ID automaticamente. Quando chamado no Bloco 3, vão como avulsos (`parentItemId = null`).

Componentes reutilizados sem mudança: `CVItemCard`, `ClientCombobox`, `SupplySearch`, `StepTypeBadge`, `DiscountPaymentBlock`, `QuoteOptionsBuilder`, `StickyFinancialSidebar`, `CreateVersionButton`.

---

## Engine de Pricing — Diluição por Item Pai

`src/lib/quotes-v2/pricing.ts`:

- `PricingMaterial` ganha `parentItemId?: string | null`.
- `PricingLaborStep` ganha `parentItemId?: string | null`.
- `recalculateForQuantity` separa custos:
  - **Filhos vinculados** → entram no markup proporcional ao item pai (usam o tier e a quantidade do pai).
  - **Avulsos** (`parentItemId == null`) → comportamento atual (soma absoluta diluída pela qty total).

`globalSettings`, `hourlyRate` e arredondamento (R$ 0,10 para cima) inalterados.

---

## Cascata de Aprovação ✅

Quando um item de impressão pai recebe `status = 'aprovado'`, todos os filhos vinculados (`parent_item_id = pai.id`) também ficam travados:

- RPC `approve_quote_items` é estendida para propagar status para filhos do mesmo conjunto aprovado.
- No save do form, materiais/labor com `parentItemId` apontando para um pai aprovado **não são deletados** (mesma lógica de preservação que já existe para itens aprovados diretos).
- Visualmente: filhos exibem o mesmo badge verde de "Aprovado" e ficam read-only.

Razão: o preço prometido ao cliente já inclui o acabamento; alterar minutos/qty de um filho depois quebraria o compromisso.

---

## Persistência (`handleSave`)

Pipeline ajustado:

1. Salva/atualiza `quotes` (com `notes`).
2. Para cada **item de impressão pai** não aprovado: insert/update primeiro, captura `id` real do banco.
3. Para cada **filho** (`parentItemId` preenchido): insere com o `parent_item_id` apontando para o `id` real do pai.
4. Avulsos (`parentItemId == null`): mesma lógica de hoje.
5. Aprovados (pai e filhos): preserva, atualiza apenas `sort_order`.

A FK `ON DELETE CASCADE` garante que apagar um pai pendente apaga seus filhos juntos.

---

## Retrocompatibilidade

- Orçamentos antigos: todos com `parent_item_id = NULL` → renderizam 100% no Bloco 3 (Avulsos). Nada quebra.
- Engine trata `parentItemId` ausente exatamente como o cálculo atual.
- `ClientViewer` (público) continua mostrando lista plana de materiais aprovados/pendentes — sem mudança nessa fase.
- V1 (`/orcamentos`) intocado.

---

## Não Mudam

Lista (`OrcamentosV2.tsx`), filtros, badges, BulkActionBar, RealtimeRadar, Viewer público, aprovação parcial via WhatsApp, engajamento/temperatura, tracking, scroll depth, versionamento, modelos, clonagem, geração de Pedido/OP, engine CV (`cv-pricing/engine.ts`), multiplicadores de impressão (A3/SRA3=2x, F/V=2x, stackáveis até 4x), arredondamento global R$ 0,10 para cima.

---

## Ordem de Implementação

1. **Migration** — colunas `parent_item_id` (×2) + `notes` + índices.
2. **Engine `pricing.ts`** — estender tipos e `recalculateForQuantity` com diluição por pai.
3. **RPC `approve_quote_items`** — propagar aprovação para filhos vinculados.
4. **Componentes novos** — `PrintingItemEditor.tsx` + `LaborAndSupplySubform.tsx`.
5. **`LoadFromGroupDialog`** — aceitar prop `parentItemId`.
6. **`NewQuoteFormV2.tsx`** — refatorar para 4 etapas, agrupar render por pai, estender state com `parentItemId`, pipeline de save em duas fases (pai → filhos), carregar `notes` no edit.

Pronto para implementar quando você aprovar.
