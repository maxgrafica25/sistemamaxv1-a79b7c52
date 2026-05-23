## Objetivo
No formulário **Cartão de Visita** (V3), substituir a fonte dos acabamentos opcionais: em vez de buscar em **Acabamentos** (`finishings_price_items`), buscar em **Processos de Produção** e **Grupos de Etapas** (`production_steps` + `step_groups` / `step_group_items`).

Assim você cadastra um grupo "Cartão de Visita" em **Grupos de Etapas** com todas as etapas (corte, laminação, etc.) e ele vira chip no cartão.

## Como vai funcionar
- Carrega processos individuais e grupos via o hook já existente `useV3ProcessCatalog` (mesma fonte usada pelo `ProcessPicker` do V2).
- Filtra por nome contendo **"cartão de visita"** (case e acento-insensível) — tanto em `production_steps.description` quanto em `step_groups.name`.
- Cada chip mostra:
  - Para etapa individual: `{descrição} — X min (≈ R$ Y)`
  - Para grupo: `{nome do grupo} — soma_min min (≈ R$ Y)` (Y = soma dos minutos × hourlyRate/60)
- Selecionar um chip adiciona o custo de mão de obra ao item (rateado por folha, igual ao fluxo atual de finishings per_unit → perSheet).
- Mantém o restante do form intacto (papel Couchê 300 SRA3, layout, F/V, qtd).

## Arquivos alterados
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`
  - Remover `listFinishings` / `printFinishings` / `FinishingItem`.
  - Usar `useV3ProcessCatalog()` + `useHourRate()` (já existe em `src/hooks/useHourRate.ts`).
  - Filtrar `steps` e `groups` por nome contendo "cartao de visita" (normalizado).
  - Construir `finishes: FinishingDef[]` unificando os 2 (prefixo opcional ⚙ etapa / 🗂 grupo).
  - Calcular custo de cada selecionado: `minutes/60 * hourlyRate`. Custo total selecionado é rateado pelo nº de folhas para `finishingExtraPerSheet`.
  - `finishing_selections` no item adicionado registra cada escolhido como `{ id, name, pricing_model: "per_unit", unit_label: "min", price: custoTotal, cost: custoTotal }` para preservar visibilidade no carrinho.
  - Atualizar fallback: "Cadastre uma etapa ou grupo com 'Cartão de Visita' no nome em Processos de Produção / Grupos de Etapas".

## Fora de escopo
- Não cria nova tabela nem modifica `production_steps`/`step_groups`.
- Não altera nenhum outro form (Print, Booklet, etc.).
- Não toca no engine de pricing nem nas regras de papel SRA3.