## Problema

As abas inativas ("Com. Visual" e "Terceirizados") hoje aparecem só como texto cinza ao lado da aba ativa (com fundo roxo). Sem borda, sem fundo, sem separação — parecem rótulos, não botões. O usuário não percebe que são clicáveis.

## Direção proposta

Dar a TODAS as abas uma forma visual de "botão/aba", mantendo hierarquia clara entre ativa e inativas. Sem poluir: sutil em repouso, evidente no hover.

### Mudanças em `src/components/orcamentos-v3/workspace/TabsLayout.tsx`

1. **Abas inativas ganham contorno sutil de aba**
   - Fundo `bg-muted/40` (cinza muito leve) em repouso → dá forma de "pílula/aba" sem competir com a ativa.
   - Borda fina `border border-border/60` nas laterais e topo (sem borda inferior, encostando na linha do tablist) — reforça a metáfora de aba de pasta.
   - Cursor pointer já vem do `<button>`, mas o contorno + fundo deixam claro que é interativo.

2. **Hover mais evidente**
   - `hover:bg-muted` + `hover:text-foreground` + `hover:border-border` — feedback claro ao passar o mouse.
   - Pequena elevação visual: `hover:-translate-y-0.5` com `transition-transform` (microinteração, ~150ms).

3. **Aba ativa permanece destacada**
   - Mantém `bg-primary/10` + `text-primary` + barra inferior roxa.
   - Ganha também `border border-primary/30` (laterais/topo) para casar com a forma das inativas, mas em roxo.

4. **Espaçamento**
   - Aumentar `gap-2` entre abas (já existe em md+) para que cada uma se leia como item separado.
   - Manter a linha inferior do tablist (`border-b`) — é o "trilho" das abas.

### Resultado esperado

- Em repouso: três "abas" visíveis lado a lado, a ativa em roxo claro com barra inferior, as inativas em cinza claro com contorno sutil. Fica óbvio que são 3 opções selecionáveis.
- No hover: a inativa "acorda" (fundo mais escuro, leve elevação) — afirma a clicabilidade.
- Sem poluição: nada de ícones extras, badges ou cores fortes em inativas.

### Fora de escopo

- Não mexer no atalho `kbd` (Alt+1/2/3).
- Não mexer nos ícones nem nos labels.
- Não tocar nas descrições abaixo dos tabs.

### Validação

Em `/orcamentos-v3/novo`: as três abas devem parecer claramente clicáveis em repouso; hover em "Com. Visual" ou "Terceirizados" deve dar feedback visual imediato; clicar continua trocando o conteúdo normalmente.
