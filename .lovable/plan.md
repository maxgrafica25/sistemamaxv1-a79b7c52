## Nova seção: Resumo Financeiro Detalhado

Adicionar um bloco fixo (não-acordeão) no `StickyFinancialSidebar.tsx`, logo abaixo do card "Lucro Líquido Estimado", visível apenas para administradores (mesma regra de privacidade já adotada para o DRE e o Lucro Estimado).

### Localização
Arquivo: `src/components/orcamentos-v2/StickyFinancialSidebar.tsx`
Posição: dentro do `Body`, após o bloco `{isAdmin && ( ... Lucro Líquido Estimado ... )}`.

### Conteúdo do bloco

Título: "Resumo Financeiro" (mesmo estilo das demais seções: `text-[11px] uppercase tracking-wide text-muted-foreground`).

Lista vertical (sem acordeão), cada linha com label à esquerda, badge de % quando aplicável e valor em R$ à direita, formato tabular:

1. **Custo Total do Produto/Serviço** — `formatBRL(productionCost)`
2. **Impostos** — badge `taxPct%` + `formatBRL(taxValue)`
3. **Perdas/Desperdícios** — badge `lossPct%` + `formatBRL(lossValue)`
4. **Taxas de Cartão/Pagamento** — badge `billingPct%` (+ nome do método quando houver) + `formatBRL(billingValue)`
5. **Separator**
6. **Lucro Bruto** — `formatBRL(revenueBase - productionCost)` (cor neutra/foreground, semibold)
7. **Lucro Líquido Final** — badge `netMarginPct%` + `formatBRL(netProfit)` (cor dinâmica: verde ≥10%, âmbar 0–10%, vermelho <0; com ícone `AlertTriangle` quando margem baixa, igual ao DRE atual)

Observação: as porcentagens dos itens 2–4 já são calculadas sobre o `revenueBase` (Valor da Proposta) pelo pricing existente, então reutilizamos `taxPct`, `lossPct`, `billingPct` que já chegam como props — sem nova lógica de cálculo.

### Estilo

- Container: `rounded-md border border-border/60 bg-muted/30 px-3 py-2 space-y-1.5`
- Linhas: reutilizar o componente interno `DRELine` existente (já tem label + badge + valor tabular) para itens 1–4.
- Lucro Bruto e Lucro Líquido: linhas custom com `font-semibold`, números em `tabular-nums`, separator entre os dois.
- Sem alteração de tokens de cor — usar `text-emerald-600`, `text-amber-500`, `text-destructive` já em uso no arquivo.

### O que NÃO muda

- Acordeão "Ver detalhamento de custos e lucro" permanece (é uma DRE com sinais negativos; este novo bloco é uma leitura plana e sempre visível).
- Nenhuma alteração de props, cálculos ou outros componentes.
- Visibilidade: admin-only (consistente com o restante da área financeira sensível).

### Detalhes técnicos

- Edição única em `StickyFinancialSidebar.tsx`.
- Reuso de `formatBRL`, `fmtPctRaw`, `formatPct`, `DRELine`, `Separator` e ícone `AlertTriangle` já importados.
- Sem novas dependências.
