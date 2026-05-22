Corrigir alinhamento dos badges de economia (`−X% un`) ao final de cada linha de faixa em `UnifiedCart.tsx`.

Sintomas no screenshot:
- O `un` quebra para a linha de baixo (badge sem `whitespace-nowrap`).
- O badge fica desalinhado/torto à direita.

Alterações em `src/components/orcamentos-v3/cart/UnifiedCart.tsx`, dentro de `renderTierRow`:

1. Badge de economia (linha 334): adicionar `whitespace-nowrap` e largura fixa para alinhar com o placeholder. Trocar:
   - `"inline-flex rounded px-1.5 py-0 text-[10px] font-medium bg-emerald-50 ... tabular-nums"`  
   - por: `"inline-flex justify-center w-[48px] shrink-0 rounded px-1 py-0 text-[10px] font-medium bg-emerald-50 ... tabular-nums whitespace-nowrap"`

2. Placeholder vazio (linha 338): manter `w-[48px] shrink-0` para garantir mesma largura entre linhas com e sem badge.

3. Reduzir o gap entre badge e botão de lixeira: revisar `gap-2` da `<li>` para `gap-1.5` para evitar overflow do card quando a coluna fica apertada (preview 1336px com sidebar).

Sem mudanças em lógica, dados ou cores. Apenas controle de quebra e largura para alinhar verticalmente os badges.