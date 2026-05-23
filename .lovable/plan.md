## Diagnóstico

Os 4 acabamentos "Arte —" cadastrados em `finishings_price_items` estão assim:

- `pricing_model = per_unit`, `unit_label = arte`, `price_per_sheet = 0`
- `production_step_id` vinculado (5/10/20/30 min)
- `applies_to = {impressao, etiqueta}`

Comportamento atual:

| Form | Toggle aparece? | Gera mão de obra (min × R$/hora)? | Aparece no total? |
|---|---|---|---|
| PrintForm (Impressão personalizada) | sim | sim, via `buildLinkedLaborItems` | sim — mas o hint mostra "R$ 0,00/arte", o que dá a impressão de não somar |
| LabelEmbeddedForm (Etiquetas) | **não** — formulário nem renderiza `FinishingProgressive` | não | não |
| BookletForm (Revista) | **não** | não | não |

Resumo: só Impressão personalizada gera o custo. Etiquetas e Revista ignoram completamente os acabamentos do catálogo unificado (inclusive os "Arte —"). Quando o cliente está em Etiquetas (caso do print enviado), ligar "Arte — Ajuste" não soma nada porque o form não cria nenhum item de mão de obra.

A página de Arte interna (`ArtePromptBlock` + `makeArtInternal`) é o caminho oficial via "Tem arte pronta?", mas o usuário está usando o caminho paralelo via catálogo de acabamentos — esse caminho precisa funcionar igual.

## Plano

### 1. PrintForm — hint correto

Em `src/components/orcamentos-v3/forms/PrintForm.tsx`, no `useMemo` de `finishes`:
- Se `pricing_model === "per_unit"` **e** `price_per_sheet === 0` **e** `production_step` existe → hint passa a mostrar o custo real:  
  `${fmtBRL((min/60) * hourlyRate)}/${unit_label} · +X min`
- Caso contrário, mantém o comportamento atual.

Já existe `useV3HourlyRate()` no escopo, então é só consumir `hourlyRate`.

### 2. LabelEmbeddedForm — habilitar acabamentos + mão de obra

Em `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx`:
- Carregar `listFinishings("etiqueta")` (mesmo padrão do PrintForm).
- Adicionar bloco "Acabamentos" com `FinishingProgressive` antes do botão Adicionar.
- No `submit`, gerar `V3LaborItem[]` para cada acabamento ligado que tenha `production_step` (mesma lógica do `buildLinkedLaborItems` do PrintForm), com `bundle_id` agrupando os labors ao item label.
- Usar `useV3HourlyRate()` para `hourly_rate`.
- Passar para o callback `onAddTiers` / `onAdd` os labors junto via uma nova prop `onAddMany?` (igual PrintForm) — incluir o novo handler no chamador (`PrintAndProductForm.tsx`).

### 3. BookletForm — mesma extensão

`src/components/orcamentos-v3/forms/BookletForm.tsx` segue o mesmo padrão do PrintForm (`listFinishings("impressao")` + `buildLinkedLaborItems`).

### 4. Aviso no cadastro de acabamento

Em `Acabamentos` (página de cadastro de `finishings_price_items`), quando o acabamento for `per_unit` com preço 0 e sem `production_step_id` vinculado, mostrar aviso amarelo: *"Esse acabamento não tem preço nem etapa vinculada — ficará grátis no orçamento. Vincule uma etapa de produção para cobrar pelo tempo."*

### 5. Validação visual no orçamento

Confirmar via preview, com um item de etiquetas + "Arte — Ajuste" ligado:
- hint mostra `R$ 4,25/arte · +5 min` (5/60 × 50,99)
- item de mão de obra aparece bundled abaixo do item de etiquetas
- subtotal sobe pelo valor correspondente

## Fora do escopo

- Não mexer no `ArtePromptBlock` (caminho "Tem arte pronta?") — continua funcional.
- Não mexer no cálculo dos demais acabamentos (laminação, vinco, etc.).
- Não migrar os 4 registros "Arte —" do catálogo para outro lugar — eles continuam como acabamento per_unit com etapa vinculada.
