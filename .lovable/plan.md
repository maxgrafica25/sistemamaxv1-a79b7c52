
# Plano — Acabamentos CV com MO dinâmica (processos) + seed chapa

## Problema

Hoje os campos `extra_cost_*` em `cv_calc_acabamentos` armazenam **valores fixos** (R$/m², R$/m, R$ fixo). Quando o custo/hora muda (despesas, salários) ou um processo fica mais rápido, é preciso reeditar cada acabamento manualmente — exatamente o que a planilha já obriga.

Solução: ligar cada acabamento a uma **receita de processos** (lista de `production_steps` com tempos em minutos, e a **escala** em que cada tempo se aplica). O custo de MO passa a ser:

```
custo_mo = Σ ( time_minutes / 60 × hourRate × escala(área|perímetro|peças|unidades) )
```

Quando muda `useHourRate` ou o `time_minutes` da etapa, **todos** os acabamentos recalculam automaticamente.

## Parte 1 — Schema

Nova tabela `cv_calc_acabamento_labor_items` (mesmo padrão de `cv_calc_acabamento_recipe_items`):

| coluna | tipo | nota |
|---|---|---|
| id | uuid PK | |
| acabamento_id | uuid FK → cv_calc_acabamentos | cascade delete |
| production_step_id | uuid FK → production_steps | nullable (pode digitar livre) |
| descricao | text | snapshot do nome da etapa (editável) |
| time_minutes | numeric | snapshot (override do step) |
| consumo_tipo | text | `por_peca \| por_mt2 \| por_perimetro_m \| por_largura_m \| por_altura_m \| fixo` |
| consumo_qty | numeric default 1 | multiplicador |
| sort_order | int | |

Snapshot do `time_minutes` permite ajustar para um caso específico sem mudar a etapa global. Se nulo, lê do `production_steps` em runtime.

RLS: admin all + authenticated select (igual recipe_items).

Manter `extra_cost_*` como **fallback de migração**; novos acabamentos usam labor_items.

## Parte 2 — Engine

`engine.ts → precificarAcabamento`:

- Carregar `labor_items` no `Acabamento` (junto com `recipe`).
- Adicionar parâmetro `hourRate` em `CalcInput` (já temos `useHourRate`).
- Calcular `custo_mo` somando cada item conforme `consumo_tipo` (mesma lógica do `recipe`).
- `custo_total` = `custo_recipe + custo_mo + extra_cost_* (legado)`.
- Resto (markup, arredondamento) inalterado.

Função utilitária `calcLaborCost(items, ctx)` reaproveitável.

## Parte 3 — UI Acabamentos (AcabamentosTab)

No dialog em modo `recipe`, novo bloco **"Mão-de-obra (processos)"** abaixo do bloco de Receita:

- Botão "+ Adicionar etapa"
- Cada linha: combobox de `production_steps` · tempo (min, prefill do step, editável) · escala (select igual ao recipe) · qtd
- Hint: "💡 O custo é recalculado automaticamente quando o custo/hora mudar"
- Mini preview "Custo MO estimado: R$ X,XX @ R$ Y/h" usando `useHourRate`

## Parte 4 — Seed dos acabamentos de chapa (corrigido)

Conforme correção do usuário — entradas **separadas** entre chapa/lona quando o processo difere, e famílias ajustadas:

| Nome | Família | Mídia | MO (processos) | Custo material/outros |
|---|---|---|---|---|
| Corte até 3mm | recorte | chapa | (a definir nos processos) | — |
| Dupla Face | bainha_ilhos? | **lona** | refile R$2/m² → 8min/m² @ hourRate | fita dupla face na recipe |
| Ilhós Chapa | ilhos | chapa | só ilhós, sem bainha | ilhós por unidade |
| Ilhós Lona (já existente) | bainha_ilhos | lona | bainha + ilhós | — |
| Laminação Vinil | laminacao | chapa | aplicar + refilar | vinil por m² |
| Corte Ímã Automotivo | recorte | chapa (ímã) | — | — |
| Recorte Especial | recorte | chapa | — | — |
| Recorte Reto | recorte | chapa | — | — |
| Laminação Bopp | laminacao | chapa | — | bopp por m² |
| Display (placa c/ dobra) | **outro (dobra)** ou nova família `dobra` | chapa | tempo de dobra | — |

**Pendências antes de seedar** (ver questões abaixo).

## Parte 5 — Migração dos dados legados

Script único: para cada acabamento existente com `extra_cost_mt2 > 0`, criar 1 `labor_item` "Mão-de-obra legada" com `time_minutes = extra_cost_mt2 / hourRate × 60` e zerar `extra_cost_mt2`. Opcional — pode ficar como manual ("revisar e remigrar" no admin).

## Ordem de execução

1. Migration `cv_calc_acabamento_labor_items` + RLS
2. Engine: parâmetro `hourRate`, função `calcLaborCost`, soma em `precificarAcabamento`
3. UI: bloco "Mão-de-obra (processos)" no AcabamentosTab + preview
4. Calculadora/Orçamento V2: passar `hourRate` ao calcular (já têm hook)
5. Seed dos 9 acabamentos de chapa via insert tool (após responder questões)

## Questões antes de seedar (Parte 4)

1. **Família "Dobra"**: criar nova família `dobra` no enum, ou usar `outro` para o Display?
2. **Dupla Face**: você confirmou "é lona" — devo migrar a entrada para `tipos_midia_compativeis = ['lona']` apenas (não chapa)?
3. **Tempos exatos dos processos de chapa** (cortar chapa 4min/m², aplicar adesivo 9min/m², refilar 2min/m² — assumindo R$60/h?) — preciso confirmar os minutos para cada etapa, ou cadastro as etapas com valores estimados e você ajusta depois em Processos?
