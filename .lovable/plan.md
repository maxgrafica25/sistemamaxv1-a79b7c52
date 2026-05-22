## Refinar UX das faixas de quantidade — `TierFaixasPanel.tsx`

**Problema:** após remover as caixas, o painel ficou "solto" demais — sem âncora visual e o campo de quantidade custom não se diferencia do resto.

### Ajustes (apenas visuais, lógica intacta)

**1. Ancorar o painel sem virar caixa pesada**
- Adicionar fundo sutil `bg-muted/30` + `rounded-md` + `px-3 py-2.5` ao container raiz. Sem borda — só o fundo levemente cinza para agrupar visualmente.
- Mantém ar de "seção" sem voltar ao border pesado anterior.

**2. Diferenciar a linha solicitada**
- Aplicar `bg-background rounded` na linha `r.primary` (fica branca sobre o fundo cinza claro do painel) — destaca naturalmente sem badge.

**3. Reorganizar a linha de ações (chips + input)**
- Separar visualmente os atalhos do input custom com um divisor sutil:
  - Esquerda: chips `−5 / +5 / +10 / +15` (atalhos rápidos).
  - Divisor: `<span className="h-4 w-px bg-border/60 mx-1" />`.
  - Direita: label inline `text-[10px] uppercase text-muted-foreground` "Outra:" + input + botão "+".
- Input ganha destaque: trocar fundo (`bg-background`), borda mais visível (`border-input` em vez do default), e largura um pouco maior (`w-24`). Placeholder mais claro: `"ex: 250"`.
- Botão "+" vira `variant="secondary"` (em vez de `ghost`) para deixar evidente que é o gatilho de adicionar.

**4. Micro-ajustes**
- Pequeno aumento do espaçamento entre lista e linha de ações (`pt-2` em vez de `pt-1`) com `border-t border-border/40` discreto entre eles, para separar "consulta" de "ação".

### Fora de escopo
- Nenhuma mudança em `UnifiedCart`, lógica de cálculo, localStorage ou props.

### Validação
`/orcamentos-v3/novo` (1336×895), aba Impressão preenchida:
- Painel destacado por fundo cinza claro, sem peso de borda.
- Linha solicitada branca sobressai naturalmente.
- Campo "Outra: [___] [+]" claramente convidativo, separado dos chips por divisor vertical.
