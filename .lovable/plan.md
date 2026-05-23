## Mostrar detalhamento dos acabamentos por padrão

Hoje, no editor de Cartão de Visita (e demais formulários que usam `FinishingProgressive`), cada linha de "Acabamentos" e "Acabamentos opcionais" lista só o nome — o usuário precisa clicar no chevron para ver as sub-etapas que o compõem.

### Mudança

No `src/components/orcamentos-v3/shared/FinishingProgressive.tsx`:

1. Tornar o detalhamento (sub-itens) **visível por padrão** em todas as linhas que têm grupo vinculado.
2. Disparar o `onExpand()` (lazy-load das sub-etapas) automaticamente ao montar para cada item com `hasGroup` — mantém a performance, mas o usuário não precisa mais clicar.
3. Remover o botão chevron de expansão (ou mantê-lo só como "recolher" caso o usuário queira economizar espaço — preferência: **remover**, deixando a UI sempre aberta e mais legível).
4. Manter o bloco `advanced` (configuração extra que aparece quando o switch é ligado) inalterado.

Resultado: ao abrir o cartão de visita, o usuário vê na hora todas as sub-etapas de "Corte de 100 Cartões de visita" e "Laminação para 100 cartões de visita" sem precisar clicar em nada.
