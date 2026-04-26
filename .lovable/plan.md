# Histórico de Preços — Refatoração UX/UI (v2)

Transformar o histórico atual em ferramenta de gestão real, com **duas visões** alimentadas pela **mesma tabela centralizada** — uma operacional (no equipamento) e uma gerencial (global). Inclui **barganha por melhor preço histórico** e **preço unitário automático** para compras em múltiplas unidades.

---

## 1. Banco de Dados (mínimas mudanças, máxima compatibilidade)

A tabela `consumable_price_history` já existe e segue como fonte única. Adicionar:

- `supplier` (text) — fornecedor
- `invoice_ref` (text) — NF / pedido / referência
- `quantity` (numeric, default 1) — unidades compradas (numeric para aceitar 1.5L, 0.5kg, etc.)
- `unit_price` (numeric, **generated column**) — `price / NULLIF(quantity, 0)` calculado automaticamente pelo banco

> **Por que numeric e generated column?** Garante que o preço unitário seja consistente em qualquer query/relatório, sem depender do client. Ex: 2 toners por R$ 500 → `unit_price = 250`. 5L de tinta por R$ 750 → `unit_price = 150/L`.

Registros antigos (sem quantity) assumem `1` por default → `unit_price = price`. Compatibilidade total.

---

## 2. Visão Global (nova) — "Histórico de Preços"

Nova aba no nível da página `Equipamentos.tsx`. **Cérebro gerencial.**

```text
┌─────────────────────────────────────────────────┐
│ KPIs (4 cards)                                   │
│ Compras 30d │ Gasto 30d │ Var. média │ +Caro 30d │
├─────────────────────────────────────────────────┤
│ [Equip ▾] [Fornecedor ▾] [Período] [Buscar]      │
│                              [+ Registrar compra]│
├─────────────────────────────────────────────────┤
│ ▾ Toner Preto HP 26A     R$/un 245  ↑ +8% (12m) │
│   🏆 Menor histórico: R$ 190 — Office (mar/24)   │
│   ─── sparkline ───                              │
│   [Timeline detalhada ao expandir]               │
│ ▸ Cilindro Brother DR-820  R$/un 380  ↓ -3%     │
└─────────────────────────────────────────────────┘
```

**Recursos-chave:**
- KPIs de período (compras, gasto, variação média, item que mais subiu).
- Filtros: equipamento, fornecedor, período (30d/90d/12m/custom), busca.
- **Tudo em preço unitário** (`unit_price`) para comparação justa entre compras de quantidades diferentes.
- **Selo 🏆 "Menor preço histórico"** abaixo do nome do consumível: mostra valor + fornecedor + data. Sempre visível.
- Sparkline com últimas 12 compras (eixo Y = preço unitário).
- Comparativo de fornecedores: chip do menor preço atual destacado em verde.
- **Botão "Registrar compra"** sempre acessível.

---

## 3. Visão por Equipamento (refinada) — aba "Histórico"

Refeita em `ConsumablePriceHistoryTab.tsx`. Foco operacional.

```text
┌──────────────────────────────────────────────┐
│ Gasto 90d │ Var. média │ Compras              │
├──────────────────────────────────────────────┤
│ Toner Preto             R$/un 245   ↑ +5%   │
│ Última: 12/03 • Office • 1 un • R$ 245       │
│ 🏆 Menor: R$ 190 (Office, mar/24) — economiza│
│    R$ 55/un se barganhar nesse valor         │
│ ─── sparkline ───                            │
│                                              │
│ Cilindro                R$/un 380   ↓ -2%   │
│ ...                                          │
└──────────────────────────────────────────────┘
```

**Recursos-chave:**
- Um card por consumível do equipamento.
- Sempre mostra **preço unitário** (não preço pago bruto).
- Variação % vs compra anterior (verde ↓ / vermelho ↑).
- **Selo 🏆 + cálculo de economia potencial** ("economiza R$ X/un se barganhar nesse valor") — poder de barganha direto.
- Expandir → timeline completa com qtd, preço pago, preço unit, fornecedor, NF.
- Botão "Registrar compra" no topo (modal pré-preenchido com o equipamento).

---

## 4. Modal "Registrar Compra"

Modal único compartilhado.

```text
┌─────────────────────────────────────────┐
│ Registrar compra                        │
├─────────────────────────────────────────┤
│ Equipamento: [HP M404 ▾]                │
│ Consumível:  [Toner Preto HP 26A ▾]     │
│                                          │
│ 🏆 Menor preço histórico: R$ 190/un      │
│    Office Suprimentos · mar/24           │
│                                          │
│ Quantidade: [2]    Preço total: [R$ 500]│
│ → Preço unitário: R$ 250,00 (calculado) │
│ ⚠ Acima do menor histórico em R$ 60/un  │
│                                          │
│ Fornecedor:   [Office ▾] (sugestões)    │
│ NF / Pedido:  [12345]                   │
│ Data:         [26/04/2026]              │
│ Obs:          [_____________________]    │
│                                          │
│ ☑ Atualizar preço base do consumível    │
│              [Cancelar]  [Salvar]        │
└─────────────────────────────────────────┘
```

**Comportamento:**
- Ao escolher consumível: busca menor preço histórico e mostra selo 🏆 acima dos campos.
- Preço unitário calculado em tempo real (`total / quantity`) e exibido com destaque.
- **Aviso inteligente** comparando com menor histórico: verde se igual/menor, amarelo se acima.
- Combobox de fornecedor sugere os já usados antes (distinct de `supplier`).
- Checkbox "Atualizar preço base" usa `unit_price` (não o total) — corrige bug conceitual.

---

## 5. Detalhes Técnicos

- **Fonte única**: `consumable_price_history` + join com `equipment_consumables` para obter `equipment_id` e `name`.
- **Migração**:
  ```sql
  ALTER TABLE consumable_price_history
    ADD COLUMN supplier text,
    ADD COLUMN invoice_ref text,
    ADD COLUMN quantity numeric NOT NULL DEFAULT 1,
    ADD COLUMN unit_price numeric GENERATED ALWAYS AS (price / NULLIF(quantity, 0)) STORED;
  CREATE INDEX idx_cph_supplier ON consumable_price_history(supplier);
  CREATE INDEX idx_cph_consumable_date ON consumable_price_history(consumable_id, change_date DESC);
  ```
- **Menor preço histórico**: query `MIN(unit_price)` por `consumable_id` + linha completa para mostrar fornecedor/data.
- **Sparkline**: `recharts` (já instalado) em modo minimalista, eixo Y = `unit_price`.
- **Sugestão de fornecedores**: query distinct em `supplier` no client (volume baixo).
- **Realtime**: adicionar `consumable_price_history` ao publication `supabase_realtime`.
- **RLS**: já cobre — políticas existentes valem para colunas novas.

---

## 6. Arquivos

**Criados:**
- `src/components/equipamentos/PriceHistoryGlobalTab.tsx` — visão global
- `src/components/equipamentos/PriceHistoryCard.tsx` — card reusado nas duas telas (preço unit + variação % + selo 🏆 + sparkline)
- `src/components/equipamentos/RegisterPurchaseDialog.tsx` — modal compartilhado com cálculo de unitário e alerta de barganha
- `src/components/equipamentos/SupplierCombobox.tsx` — combobox com sugestões

**Editados:**
- `src/components/equipamentos/ConsumablePriceHistoryTab.tsx` — refeito como visão enxuta por equipamento
- `src/pages/Equipamentos.tsx` — adicionar tab "Histórico de Preços" global no topo

**Migração SQL** (única, não-destrutiva): colunas + índices.

---

## 7. O que NÃO muda

- Schema atual preservado — apenas colunas adicionais.
- Fluxo "editar consumível → gera histórico" continua funcionando (assume quantity=1).
- RLS, manutenções, leituras, dashboard — nada afetado.
