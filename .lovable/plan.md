## Objetivo
Evitar que o orçamento quebre quando uma etapa (`production_steps`) ou item de grupo (`step_group_items`) não tiver `time_minutes` definido. Assumir `0` minutos nesses casos e emitir `console.warn` para facilitar diagnóstico.

## Arquivos alterados

### 1. `src/components/orcamentos-v3/shared/useV3ProcessCatalog.ts`
Centralizar o fallback na fonte dos dados (já usa `Number(...) || 0`, mas hoje silencioso):

- Ao mapear `stepsRes.data`: se `s.time_minutes` for `null/undefined/NaN`, fazer `console.warn("[useV3ProcessCatalog] etapa sem time_minutes", { id, description })` e usar `0`.
- Ao mapear `groupItemsRes.data`: idem, com `console.warn("[useV3ProcessCatalog] item de grupo sem time_minutes", { step_group_id, description })`.
- Manter o tipo `number` (sempre numérico) — nenhum consumidor precisa mudar.

### 2. `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`
Defesa em profundidade no cálculo do chip (`cvProcs` memo) e em `procCost`:

- No `cvProcs`, ao somar minutos do grupo, usar `Number(it.time_minutes) || 0` e, se algum item resultar em `0` por falta de valor, `console.warn` uma vez por grupo identificando os itens problemáticos.
- Em `procCost(minutes)`, tratar `minutes` não-finito como `0` (sem `NaN` propagando para o preço).
- Garantir que chip com `minutes === 0` ainda renderiza (com `hint` "0 min · R$ 0,00") em vez de quebrar — comportamento atual já tolera, só formalizar.

## Fora de escopo
- Não alterar schema do banco nem adicionar `NOT NULL`/default em `time_minutes`.
- Não mudar outros forms (Print, Booklet, etc.) — escopo é o fluxo do Cartão de Visita que acabamos de migrar.
- Não tocar no engine de pricing nem em `useHourRate`.

## Como validar
1. Abrir `/orcamentos-v3` → aba Cartão de Visita: chips continuam aparecendo normalmente para etapas/grupos com tempo.
2. Cadastrar (manualmente no banco) uma etapa "Cartão de Visita Teste" sem `time_minutes`: form não quebra, chip aparece com `0 min`, e o console mostra o `warn` com o id/descrição.
3. Selecionar esse chip: `finishingExtraPerSheet` = 0, preço final permanece válido (sem `NaN`/`R$ NaN`).
