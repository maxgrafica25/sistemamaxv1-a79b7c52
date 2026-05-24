# Regime de cálculo configurável: por dentro × por fora

## Objetivo
Introduzir um toggle global **"Regime de cálculo de preço"** que define como impostos, taxas e margem são aplicados nos módulos Impressão, V3, CV e Etiquetas. Default **"por fora"** (comportamento atual) para não impactar preços já praticados. Quem quiser margem contabilmente correta ativa **"por dentro"**.

## Mudanças

### 1. Banco — `global_settings`
Adicionar coluna:
- `pricing_regime` (text, default `'por_fora'`, check em `('por_fora','por_dentro')`)

### 2. Hook `useGlobalSettings`
Expor `pricing_regime` no objeto retornado, com default `'por_fora'`.

### 3. Engine de cálculo — `src/components/orcamentos-v3/shared/pricing.ts`
Na função `summarize()`:
- **por_fora** (atual): `preço = custo × (1 + margem%)`, depois imposto/taxa aplicados sobre o preço.
- **por_dentro** (novo): `preço = custo / (1 − (imposto + taxa + margem)/100)` no nível do item ou do subtotal, mantendo a margem real igual à configurada.

Estratégia: aplicar o divisor no nível do **subtotal final** (não item-a-item) para não mexer nos `priceOf*()` individuais — eles continuam mostrando o "preço bruto" do item; o ajuste por_dentro acontece em `summarize()` que retorna `total` corrigido.

### 4. CV engine — `src/lib/cv-pricing/engine.ts`
`calcularItemCV` recebe parâmetro opcional `regime` (default `por_fora`). Quando `por_dentro`, aplica divisor no `preco_total` final usando os mesmos percentuais globais (imposto + taxa + margem global).

### 5. Etiquetas — `src/lib/labels/sheet-pricing.ts` e afins
Mesmo padrão: aceitar `regime` e aplicar divisor no preço final quando `por_dentro`.

### 6. UI de configuração
Em **Configurações → Pricing/Global Settings** (ou seção existente), adicionar:
- Toggle **"Regime de cálculo de preço"** com 2 opções:
  - **Por fora** (padrão) — "Margem aplicada sobre o custo. Impostos e taxas saem da margem. Preços menores, margem real abaixo da nominal."
  - **Por dentro** (contábil) — "Impostos, taxas e margem embutidos no preço final via divisor. Margem real = margem configurada. Preços maiores."
- Alerta visual ao trocar: "Isso afetará todos os novos orçamentos. Orçamentos salvos mantêm os preços já registrados."

### 7. FinancialPanel — mostrar regime ativo
Pequeno badge "Por fora" / "Por dentro" no `FinancialPanel.tsx` para o operador saber em que regime está calculando.

### 8. Snapshot histórico
Orçamentos salvos já guardam `preco_total` no item — não retroage. Só novos cálculos respeitam o novo regime.

## Fora de escopo
- Migração de orçamentos antigos.
- Kits/`kitPricing.ts` — já é por dentro, fica como está.
- Mudar default para `por_dentro` (decisão futura).

## Detalhes técnicos
- Tabela `global_settings` é singleton (1 linha). Migration adiciona coluna com default e atualiza a linha existente.
- `summarize()` mantém assinatura, mas passa a aceitar `regime` opcional vindo de `useGlobalSettings`. Componentes que chamam `summarize` precisam passar o regime — usar contexto ou prop drilling curto.
- Fórmula por_dentro no subtotal:
  ```
  divisor = 1 − (taxPct + feesPct + marginPct) / 100
  total = cost / divisor      (se divisor > 0)
  ```
  Validação: se `divisor ≤ 0` (soma ≥ 100%), cair para por_fora e avisar no UI.
