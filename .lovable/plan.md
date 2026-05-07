## Evolução do Resumo Financeiro → DRE Simplificado + Simulador de Negociação

Transformar o card lateral `StickyFinancialSidebar` em um painel de inteligência financeira reativo, com cascata de DRE, distinção entre proposta total vs. aprovado, e custo de cobrança dinâmico amarrado à forma de pagamento.

### 1. Banco de dados (migration)

Adicionar em `company_settings`:
- `default_tax_rate` numeric default 6 (imposto %)
- `default_loss_margin` numeric default 3 (perdas %)

Criar tabela `payment_method_fees`:
- `id` uuid pk
- `method` text unique (ex: "Pix", "Cartão 3x")
- `fee_pct` numeric default 0
- `sort_order` int
- RLS: read autenticado, write admin

Seed inicial baseado nos métodos atuais de `DiscountPaymentBlock.tsx`:
```
Pix=0, Dinheiro=0, Boleto=2, Transferência bancária=0,
Cartão à vista=3.5, Cartão 2x=4, Cartão 3x=5, Cartão 4x=5.5,
Cartão 5x=6, Cartão 6x=6.5
```

### 2. Hook / lógica em `NewQuoteFormV2.tsx`

- Carregar `payment_method_fees` no `loadInit` e expor mapa `feeByMethod`.
- Carregar `default_tax_rate` e `default_loss_margin` em `companySettings` (estender hook `useCompanySettings`).
- Calcular dois cenários:
  - **Receita Proposta** = `live.totalToCharge + cvTotal` (com desconto aplicado)
  - **Receita Aprovada** = soma somente dos `materials` (e cv items) com `status === 'aprovado'`
  - **Receita Base do DRE** = aprovada se houver ≥1 aprovado, senão proposta
- **Custo de produção** = `live.costsBeforeMarkup + live.printingTotal + cvCostTotal` (escalar proporcionalmente quando estiver no modo "aprovado": custo dos itens aprovados / custo total × custo total).
- **Deduções** sobre Receita Base:
  - Imposto = receita × `default_tax_rate%`
  - Custo de Cobrança = receita × `feeByMethod[paymentMethod] ?? 0`
  - Perdas = receita × `default_loss_margin%`
- **Lucro Líquido** = receita − produção − imposto − cobrança − perdas
- **Margem Líquida %** = lucro / receita

### 3. UI: novo `StickyFinancialSidebar`

Substituir conteúdo do card por:

```
RESUMO FINANCEIRO

Valor da Proposta            R$ X.XXX,XX
Valor Aprovado (verde)       R$ X.XXX,XX   ← só se houver aprovados

▼ Ver detalhamento de custos e lucro   (Accordion shadcn)
   Receita base                R$ ...
   (-) Custo de produção       R$ ...
   (-) Impostos        (6%)    R$ ...
   (-) Cobrança · Pix  (0%)    R$ ...   ← reativo ao select
   (-) Perdas          (3%)    R$ ...
   ─────────────────────────────────
   = Lucro Líquido    (XX,X%)  R$ ...   verde/vermelho + AlertTriangle se <10%

VALOR A COBRAR              R$ X.XXX,XX  (destaque primário, valor da receita base = o que o cliente paga)
```

- Cor do lucro: `text-emerald-600` positivo, `text-destructive` negativo.
- Ícone `AlertTriangle` amarelo ao lado quando margem líquida < 10% e > 0.
- Reescrever também a versão mobile (bottom bar) — mostrar margem líquida em vez da bruta atual.

### 4. Props do componente

`StickyFinancialSidebar` recebe agora:
```
proposalTotal, approvedTotal, hasApproved,
productionCost, taxPct, taxValue,
billingPct, billingMethod, billingValue,
lossPct, lossValue,
netProfit, netMarginPct
```

### 5. Fora de escopo

- PDF/visualização cliente: inalterada (só o operador vê o DRE).
- Cálculo de markup/preço de venda dos itens: inalterado.
- Não alterar `DiscountPaymentBlock` (apenas consumir o método selecionado).

### Detalhes técnicos

- Arquivo principal a editar: `src/components/orcamentos-v2/StickyFinancialSidebar.tsx` (reescrita) e `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (preparar dados).
- Estender `src/hooks/useCompanySettings.tsx` para expor `defaultTaxRate` e `defaultLossMargin`.
- Status aprovado já existe em `PricingMaterial.status` ('aprovado') — usar para filtrar.
- Migration única + seed dos `payment_method_fees`.

Aprovado para implementar?
