## Objetivo

Permitir cadastrar acabamentos avulsos (não cadastrados no sistema) diretamente dentro do orçamento, em **dois pontos**:

1. **Itens de Comunicação Visual** — popover "Adicionar acabamento" do `CVItemCard.tsx`.
2. **Itens gráficos** — bloco "Acabamentos vinculados" dentro de cada item de impressão (`LaborAndSupplySubform` em modo `compact`).

O acabamento avulso é **válido apenas para o orçamento atual** — nunca grava em `cv_finishes` nem em `finishings_price_items`. Mantém o cadastro principal limpo e padronizado.

---

## UX

### Comunicação Visual (`CVItemCard.tsx`)

No popover atual de "Adicionar":
- Acima da lista de acabamentos compatíveis, adicionar uma linha em destaque: **`+ Adicionar acabamento avulso`**.
- Ao clicar, abre um mini-form inline (ou um pequeno Dialog) com 2 campos:
  - **Nome** (texto)
  - **Valor (R$)** — preço fixo total para esse acabamento neste item
- Após "Adicionar", o item entra na lista do card como um acabamento normal, marcado com um badge discreto **"avulso"**, com botão de remover.
- Para simplicidade, todo acabamento avulso usa `tipo_calculo = "fixo"` (valor fixo total). Sem quantidade, sem m².

### Itens gráficos (`LaborAndSupplySubform` compact)

O subform já permite adicionar Mão de obra e Material livremente. Para deixar a opção explícita e alinhada com a UX da CV, adicionar um terceiro botão na action bar do modo `compact`:

- **`+ Acabamento avulso`** (ícone `Scissors`)
- Cria internamente uma linha de **Material** (já é a forma como o engine de pricing soma valores extras a um item gráfico) com `description` prefixado por "Acabamento: " e `quantity = 1`. O usuário preenche nome e valor.
- Visualmente igual às outras linhas — sem novo schema.

> Observação: nos itens gráficos não criamos um novo conceito de "acabamento" no estado/banco; reaproveitamos a linha de Material já existente, que vai ao banco como `quote_materials` normal. Isso mantém zero impacto em schema.

---

## Mudanças técnicas

### 1. `src/components/orcamentos-v2/CVItemCard.tsx`

- Estender o tipo do array `acabamentos` no `CVItemState` para aceitar avulsos:
  ```ts
  acabamentos: Array<{
    finish_id: string;              // pode ser "custom-<uuid>" para avulsos
    quantidade_unidades: number;
    custom?: { nome: string; valor: number }; // presente => avulso
  }>
  ```
- No popover, adicionar entrada `+ Adicionar acabamento avulso` que abre um pequeno form inline (2 inputs + botão Salvar).
- No mapeamento `appliedFinishes`, quando o item tiver `custom`, sintetizar um `CVFinish` em memória (`tipo_calculo: "fixo"`, `custo: valor`, `margem_pct: 0`, `categoria_compativel: [<categoria atual>]`) e passar para `calcularItemCV`.
- Renderização da lista: mesma linha, com badge "avulso" e nome digitado pelo usuário.

### 2. `src/lib/cv-pricing/engine.ts` (verificar)

- Confirmar que `tipo_calculo === "fixo"` já é tratado como "valor único somado ao acabamento" (provavelmente sim). Se não, adicionar branch.

### 3. Persistência (`NewQuoteFormV2.tsx` → `cv_quote_items`)

- Hoje os acabamentos vão para a coluna `finishes_json` (jsonb). Apenas estender o objeto serializado para incluir `custom` quando presente. Nada de schema novo.
- Na reidratação do orçamento (loadData/edit), ler de volta `custom` e reconstituir.

### 4. `src/pages/orcamentos-v2/ClientViewer.tsx`

- Ao listar acabamentos do item de CV na visualização pública, se `custom` existir, exibir `custom.nome` em vez de procurar em `cv_finishes`. Sem ele, hoje aparece vazio para acabamentos não encontrados.

### 5. `src/components/orcamentos-v2/LaborAndSupplySubform.tsx`

- Em modo `compact`, adicionar botão **`+ Acabamento avulso`** que chama `addMaterial()` com `description: "Acabamento: "` pré-preenchido (foca o input). Sem mudanças de modelo de dados.

---

## Fora de escopo

- Não cria/edita registros em `cv_finishes` ou `finishings_price_items`.
- Não muda RLS nem schema de banco.
- Não toca em compatibilidade de categorias (avulso é sempre permitido para o material atual).
