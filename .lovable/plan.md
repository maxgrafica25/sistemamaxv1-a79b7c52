## Problema

Ao abrir um orçamento parcialmente aprovado em `Editar`, o banner "Itens aprovados estão travados" aparece, mas a tabela de itens (`QuoteItemsTable`) não mostra **qual** linha está aprovada — todas parecem iguais. Os dados já existem (`status`, `approved_at` em `PricingMaterial`/`SubformMaterial`), só faltam ser exibidos.

## Solução

Adicionar um indicador visual por linha na tabela de itens da tela de edição:

1. **Badge "Aprovado" ao lado do badge de tipo (Legado/Print)** — verde, com ícone `CheckCircle2`, exibido quando `m.status === "aprovado"`.
2. **Tooltip no badge** mostrando data do aceite (`m.approvedAt`) e valor aprovado (`m.approvedValue`), quando disponíveis.
3. **Fundo sutil verde** na linha aprovada (`bg-green-50/40 dark:bg-green-950/20`) para destaque imediato.
4. **Inputs desabilitados** na linha aprovada (qtde, preço, ações de remover/duplicar) — hoje só o save respeita isso; visualmente o usuário pensa que pode editar. Botão `X` (remover) escondido em itens aprovados; botão `Copy` (duplicar) mantido (útil para criar variação).
5. **Contador no topo da tabela**: quando houver aprovados, mostrar acima do header "X de Y itens aprovados — travados nesta versão" com link para "Nova versão".

## Arquivos afetados

- `src/components/orcamentos-v2/QuoteItemsTable.tsx`
  - `renderPrint`: adicionar badge "Aprovado" e classe condicional no wrapper; desabilitar inputs e ocultar X quando `m.status === "aprovado"`.
  - `renderLegacyMaterial`: idem (já recebe `SubformMaterial` que herda `status`).
  - Header: novo bloco contador de aprovados quando houver.
- Nenhuma mudança de schema, RPC ou backend.

## Fora de escopo

- Editar item aprovado (continua bloqueado por design — a versão é o caminho).
- Mostrar status nos filhos (acabamentos vinculados) — herdam do pai, ficam visualmente "embaixo" da linha verde.
- Indicação de itens recusados (`status === "recusado"`) — pode ser acrescentado em outra interação se houver demanda.
