## Objetivo

Reformular **apenas a tela de cadastro de Kits** (`KitsProduto.tsx`) para que adicionar itens seja rápido, visual e baseado em **multi-seleção do que já está cadastrado**, em vez de preencher um formulário completo por item.

A engine, o painel no orçamento e o modelo de dados **não mudam**.

---

## Problemas atuais

1. Cada item ocupa um bloco gigante com 6 campos visíveis, mesmo quando 90% dos casos só precisam de "suprimento + obrigatório + por unidade".
2. Para montar um kit típico (4–6 itens) o usuário faz dezenas de cliques e scrolls.
3. Não dá pra ver de relance os itens que já estão no kit — cada um vira um card grande.
4. Tipo, papel e fórmula têm defaults óbvios mas exigem clique mesmo assim.
5. Variantes (espirais) ficam embutidas no mesmo card grande, dificultando enxergar a estrutura.

---

## Nova UX do cadastro

### 1. Cabeçalho enxuto

```text
[Nome do kit ............] [Tipo: apostila ▾] [✓ Ativo]   [Descrição ⓘ]
```

Descrição vira um popover/expander (raramente usado).

### 2. Lista de itens em **linha única** (estilo planilha)

Cada item ocupa **uma linha compacta** (~40px):

```text
≡  ⬡ Capa PP Camurça A4 0,30 Preta              [Obrigatório ▾]  × 1 un      ⋯  🗑
≡  ⬡ Espiral (variante por folhas · 8 faixas)   [Obrigatório ▾]  variante    ⋯  🗑
≡  ⏱ Encadernar (processo)                       [Obrigatório ▾]  × 1        ⋯  🗑
≡  ⬡ Contracapa transparente                     [Opcional ▾]     × 1 un     ⋯  🗑
```

- **≡** arrastar para reordenar (drag-and-drop com `dnd-kit`, igual `AcabamentosMediaOrderPanel`).
- **Ícone** ⬡ suprimento / ⏱ processo (cor primária).
- **Nome** truncado; tooltip mostra fornecedor + preço unitário (para suprimento) ou grupo (para processo).
- **Papel** inline (select pequeno: Obrigatório / Opcional / Alternativo).
- **Quantidade resumida** badge: `× 1 un`, `× 1 / folha`, `variante`, `auto espiral`.
- **⋯ Mais** abre popover só quando precisa: fórmula avançada, valor, grupo de alternativos, "pré-marcado", notas, e — se for variante — atalho "Editar faixas".
- **🗑** remover.

Resultado: 5–6 itens cabem na tela sem scroll, mostrando a estrutura do kit de relance.

### 3. Adicionar itens via **picker em massa** ("Adicionar acabamentos")

Botão principal `+ Adicionar acabamentos` abre um **drawer/dialog** dividido em duas abas:

**Aba Suprimentos**
- Campo de busca no topo (reaproveita `useV3Supplies`).
- Lista virtualizada com checkbox à esquerda, nome + fornecedor + preço.
- Filtro por grupo (papel, capa, espiral, etc.).
- Multi-seleção. Botão `Adicionar 4 selecionados`.

**Aba Processos**
- Mesma ideia, lista de `production_steps` com checkbox.

Defaults aplicados a cada item criado pelo picker:
- `role = required`
- `quantity_formula = per_unit`
- `quantity_value = 1`
- `auto_select_default = true`

Assim, montar um kit de 5 itens vira: 1 clique para abrir → marcar 5 → 1 clique para adicionar. Depois o usuário só ajusta o que precisa (ex.: marcar 1 como Opcional, configurar o item de espiral como variante).

### 4. Atalho "**+ Espiral por nº de folhas**"

Um segundo botão menor adiciona em **1 clique** um item já configurado com `quantity_formula = variant_by_sheets` e o preset de espirais carregado. O usuário só precisa escolher o suprimento de cada faixa (que já é a parte essencial do trabalho).

### 5. Editor de variantes em **dialog separado**

Em vez de exibir a tabela de faixas embaixo do card, o usuário clica em `⋯ → Editar faixas` (ou no badge `variante · 8 faixas`) e abre um **dialog focado** com a tabela atual (mesmo layout, mas em tela cheia no mobile). Isso remove o ruído da listagem principal e deixa o cadastro respirando.

### 6. Item alternativo: agrupamento visual

Quando há itens com `role = alternative`, eles aparecem agrupados numa **mini-seção colorida** dentro da lista:

```text
┌─ Grupo "capa" (alternativos) ─────────────────────────┐
│ ≡  ⬡ Capa PP Camurça preta            ...             │
│ ≡  ⬡ Capa PP cristal                  ...             │
└────────────────────────────────────────────────────────┘
```

Para criar/editar o grupo, basta digitar o nome no popover ⋯ — o agrupamento visual é automático.

### 7. Mobile-first

- Linhas continuam compactas (uma por item).
- Picker vira `Sheet` (drawer) bottom-up.
- Popover ⋯ vira `Sheet` inferior no mobile.
- Botão `+ Adicionar acabamentos` é sticky no rodapé do dialog.

---

## Layout final do dialog (referência)

```text
┌─ Novo Kit ────────────────────────────────────────────┐
│ [Nome..........] [Tipo: apostila ▾] [✓ Ativo] [+ desc]│
├───────────────────────────────────────────────────────┤
│ Itens do kit                                          │
│ ≡ ⬡ Capa PP Camurça A4 0,30 Preta  [Obrig ▾] ×1 ⋯ 🗑│
│ ≡ ⬡ Espiral (variante · 8 faixas)  [Obrig ▾] var ⋯ 🗑│
│ ≡ ⏱ Encadernar                      [Obrig ▾] ×1 ⋯ 🗑│
│ ┌─ Alternativos "capa" ─────────────────────────────┐│
│ │ ≡ ⬡ Capa preta            [Alt ▾] ×1 ⋯ 🗑       ││
│ │ ≡ ⬡ Capa cristal          [Alt ▾] ×1 ⋯ 🗑       ││
│ └───────────────────────────────────────────────────┘│
│                                                       │
│ [+ Adicionar acabamentos]  [+ Espiral por folhas]    │
├───────────────────────────────────────────────────────┤
│                          [Cancelar] [Criar kit]       │
└───────────────────────────────────────────────────────┘
```

---

## Arquivos a alterar

1. **`src/pages/KitsProduto.tsx`** — substituir `ItemRow` por `ItemListRow` (linha compacta) + `ItemMorePopover`. Mover variantes para `VariantsDialog`. Adicionar barra de ações inferior.
2. **Novo `src/components/kits/AddItemsPicker.tsx`** — drawer com tabs Suprimentos/Processos, busca, multi-seleção. Reaproveita `useV3Supplies` e `production_steps`.
3. **Novo `src/components/kits/VariantsDialog.tsx`** — extrai a tabela de faixas atual para um dialog separado (mesma lógica, sem mudar engine).
4. **Sem mudanças** em `productKit.ts`, migrations, `ProductKitPanel.tsx`, forms ou tipos.

---

## Fora de escopo

- Mudar como o painel no orçamento se comporta (já feito).
- Mudar schema do banco.
- Permitir editar suprimento/processo direto da linha — para isso, abre o picker e troca (ou usa o `⋯`).

---

## Sequência

1. `AddItemsPicker` (multi-seleção de suprimentos e processos).
2. `VariantsDialog` (extrai variantes para dialog).
3. Reescrita do dialog em `KitsProduto.tsx` para usar linhas compactas + popover `⋯` + ações inferiores.
4. Agrupamento visual de itens alternativos.

Pode seguir?