## Unificar Acabamentos: Etiquetas + Impressão V3

Migração do cadastro `Acabamentos` para servir **dois contextos** (Etiquetas e Impressão), mantendo Comunicação Visual e Processos de Produção separados.

### Ordem de execução

1. **Migration** (primeiro — destrava tudo)
2. **UI `/acabamentos`** (form + filtros + reposicionar na sidebar)
3. **PrintForm V3** (consumir catálogo dinâmico)

---

### 1. Migration

```sql
-- Enum (extensível depois com ALTER TYPE ADD VALUE)
CREATE TYPE finishing_pricing_model AS ENUM ('per_sheet', 'per_unit');

ALTER TABLE finishings_price_items
  ADD COLUMN pricing_model finishing_pricing_model NOT NULL DEFAULT 'per_sheet',
  ADD COLUMN applies_to text[] NOT NULL DEFAULT '{etiqueta}',
  ADD COLUMN unit_label text;

ALTER TABLE finishings_price_items ALTER COLUMN size DROP NOT NULL;

-- Trigger de validação
CREATE OR REPLACE FUNCTION validate_finishing_item() RETURNS trigger ...
  -- applies_to deve conter ao menos um de {etiqueta, impressao}
  -- per_unit exige unit_label
  -- per_sheet exige size
```

**Zero regressão:** registros existentes (2) ficam `pricing_model='per_sheet'`, `applies_to='{etiqueta}'` — Calc. Etiquetas continua idêntica.

### 2. UI `/acabamentos`

- Remove banner amarelo "exclusivo Etiquetas"; título vira só "Acabamentos"
- Form ganha:
  - **ToggleGroup "Aplicável em"** (multi): `Etiquetas` / `Impressão` — ambos marcados por padrão
  - **Select "Modelo de cobrança"**: `Por folha` / `Por unidade`
  - Se `per_unit`: campo `Unidade` (ex.: "ilhós", "dobra"), `size` fica opcional
- Novo filtro topo: `Mostrar: Todos / Etiquetas / Impressão`
- Tabela ganha coluna pequena com chips do contexto (E / I)

### 3. PrintForm V3

- Remover array hardcoded `FINISHES_PADRAO`
- Buscar `finishings_price_items` onde `applies_to @> ARRAY['impressao']` AND `is_active`
- Cada chip mostra **"a partir de R$ X,XX/folha"** ou **"R$ X,XX/un"** (catálogo base — sem mentir com R$ 0,00)
- Cálculo no engine: `per_sheet × folhas` ou `per_unit × quantidade do item`

### 4. Sidebar

- Mover `Acabamentos` para categoria **Precificação** (perto de `Preço Impressão`)

### Fora de escopo

- `cv_calc_acabamentos` (Comunicação Visual) — modelo m² próprio, não muda
- `production_steps` (Processos de Produção) — mão de obra cronometrada, não muda
- Orçamentos V2 (será substituído pelo V3)

### Arquivos

- `supabase/migrations/<nova>.sql`
- `src/pages/Acabamentos.tsx`
- `src/components/Sidebar.tsx`
- `src/components/orcamentos-v3/forms/PrintForm.tsx`
- `src/lib/finishings/catalog.ts` (helper compartilhado)

---

**Próximo passo:** rodar a migration. Aprova?