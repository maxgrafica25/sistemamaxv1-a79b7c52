## Objetivo
Definir a Taxa de Cartão (`collection_pct`) em **7%** e garantir que toda a cadeia de cálculo (motor de preços, sidebar do orçamento e tela de Configurações) use esse valor de forma consistente.

## Diagnóstico
- Hoje no banco: `collection_pct = 20`, `tax_pct = 10`, `collection_fee_pct = 5`, `waste_pct = 5`.
- O motor `src/lib/quotes-v2/pricing.ts` já lê `collection_pct` dinamicamente da tabela `global_settings` e o utiliza no divisor (`1 − (invoicePct + wastePct + collectionPct + profitMarginPct)/100`), então **não precisa** alterar a lógica — só o dado.
- A `NewQuoteFormV2.tsx` (sidebar/DRE) também consome `globalSettings.collection_pct` direto do banco. Atualizando o registro, o "Lucro Líquido Estimado" recalcula automaticamente.
- **Bug encontrado em `src/pages/Configuracoes.tsx` (linha 100/106):** ao salvar, ele grava em `collection_pct` a soma `tax_pct + collection_fee_pct + waste_pct` (composedVariable). Isso duplica `waste` e `tax` no divisor (que já os soma separadamente) e sobrescreveria o 7% no próximo save. Precisa ser corrigido para mapear o campo "Taxa de Cobrança" diretamente em `collection_pct`.

## Mudanças

### 1. Banco de dados (data update via insert tool)
```sql
UPDATE global_settings SET collection_pct = 7, collection_fee_pct = 7, updated_at = now();
```

### 2. `src/pages/Configuracoes.tsx`
- Remover `composedVariable` da gravação.
- No `handleSave`, gravar `collection_pct: parseFloat(collectionFeePct) || 0` (o campo da UI "Taxa de Cobrança" passa a ser o valor real e único da taxa de cartão).
- Atualizar o label do resumo (linha 284) para refletir apenas "Imposto + Perda" (sem incluir cobrança em dobro), ou recompor sem `collectionFeePct`.
- Default do `useState` de `collectionFeePct` passa a ser `"7"`.

### 3. Verificação (sem alterações de código)
- `pricing.ts`: confirmar que `collectionPct` vem de `snap.settings.collection_pct` — já é o caso.
- `NewQuoteFormV2.tsx`: a sidebar (`StickyFinancialSidebar`) recebe `billingPct` derivado de `globalSettings.collection_pct` — recalcula sozinho.

## Validação pós-deploy
1. Abrir Configurações → "Taxa de Cobrança" deve exibir **7,00%**.
2. Criar/abrir um orçamento → no breakdown da sidebar, "(-) Cobrança · 7,0%" e o divisor refletem o novo valor.
3. Conferir um item: Lucro Líquido Estimado aumenta vs. cenário anterior (penalização menor).