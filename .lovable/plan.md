## Refatoração visual — Orçamentos V3

Objetivo: interface mais minimalista, densa e focada em ancoragem de preço. Reduzir scroll e remover ruído visual. Apenas UI/apresentação — sem mexer em lógica de cálculo, estado ou submit.

### Parte 1 — Painel central: `TierFaixasPanel.tsx`

- **Remover** o container `border bg-muted/20` e o header com ícone/badge. Trocar por um título discreto em `text-[11px] uppercase tracking-wide text-muted-foreground` e link "Limpar" alinhado à direita.
- **Lista única e contínua**: linha solicitada + sugestões num único `<ul>` ordenado por quantidade. A solicitada é marcada apenas por `font-semibold text-primary` + sufixo `· solicitada`. Sem fundo destacado, sem header "Sugestões".
- **Separação por whitespace**: `border-t border-border/40` sutil entre a solicitada e a primeira sugestão; resto é apenas `space-y-0.5`.
- **Chips inline** abaixo da lista: `−5`, `+5`, `+10`, `+15` como `rounded-full border border-border/60 px-2.5 py-0.5 text-xs`, sem fundo forte, ficam todos numa única linha (`flex flex-wrap gap-1.5`). Input compacto (`h-7 w-20`) + botão `ghost` "+" no final da mesma linha.
- **Manter** toda a lógica de `extras`, `addQty`, `removeQty`, localStorage e `onExtrasChange`.

### Parte 2 — Carrinho lateral: `UnifiedCart.tsx`

**Densidade — `SingleCard`, `BundleCard`, card de grupo (tiers):**
- Padding do `<li>`: `p-3` → `p-2`. Ícone `p-1.5` → `p-1`. Gap `gap-2` → `gap-1.5`.
- Lista externa: `space-y-2` → `space-y-1.5`.
- **Ações (Duplicar/Excluir)** movidas para ícones pequenos (`h-6 w-6` ghost, só ícone) no **canto superior direito** do card.
  - **Sempre visíveis com `opacity-40`**, em `hover:opacity-100` e `active:opacity-100` (touch-friendly para tablets do balcão — sem depender de `group-hover`).
  - Remove o bloco inferior `mt-2 flex … opacity-60 group-hover:opacity-100`, economizando ~32px por card.
- Área expandida (ver detalhes): `space-y-0` e fontes `text-[10px]`.

**Card de grupo (tiers) — limpeza hierárquica:**
- Trocar `border-2 border-primary/30 bg-primary/[0.03]` por `border border-border/60 bg-card` (mesmo peso do single).
- **Remover** o header "SUGESTÕES" em uppercase. Separar a faixa solicitada das sugestões com `border-t border-border/40` sutil.
- Sugestões em `text-muted-foreground` para hierarquia por cor; solicitada em `font-semibold text-primary` com sufixo `· solicitada` (sem badge).

**Tag de economia (ancoragem de preço):**
- Em cada linha de sugestão, calcular `economiaPct = (unitPrimary − unitSugestao) / unitPrimary × 100`.
- Quando `> 0`, exibir badge ao lado do preço total: `inline-flex rounded px-1.5 py-0 text-[10px] font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400`, texto `−{X}% un`.
- Quando `≤ 0` (faixa menor → unit maior), não exibir badge.

### Fora de escopo

- Nenhuma mudança em pricing, submit, estado, draft, tipos.
- Sem alterações em outros forms, `FinancialPanel`, header ou layout split-screen.

### Validação

`/orcamentos-v3/novo` (viewport 1336×895):
1. Aba Impressão preenchida → painel de faixas sem caixas, chips numa única linha.
2. Adicionar 2–3 faixas → carrinho mostra grupo compacto com divisor sutil e badges verdes `−X% un`.
3. Adicionar 3 singles → 3+ cards visíveis sem scroll; ícones de ação visíveis em opacidade reduzida e plenos no toque/hover.
