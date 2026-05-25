## Objetivo

Simplificar a configuração de **Produtos Favoritos** permitindo pré-selecionar papéis por **painel/categoria** (Papel Comum, Especial, Adesivo) em vez de marcar um a um. A categoria fica no cadastro de **Papéis & Suprimentos**, e os chips individuais continuam visíveis no dialog do favorito.

## 1. Banco — nova coluna `category` em `papers`

Migração:

- Adicionar `category text NOT NULL DEFAULT 'comum'` em `public.papers` com `CHECK (category IN ('comum','especial','adesivo'))`.
- Backfill inicial pelo nome (heurística: `adesiv*` → `adesivo`; `crachá|pvc|cart(a|ã)o|couch[eê]|supremo|triplex` → `especial`; resto → `comum`). Admin pode reclassificar depois na tela.
- Índice simples em `category` (opcional).

Sem mudanças em `quote_presets` — `papel_inclui` / `papel_exclui` continuam guardando **nomes de papel** (compatibilidade total com presets já cadastrados).

## 2. Cadastro de Papéis (`src/pages/MateriasPrimas.tsx`)

- Novo campo **Categoria** no formulário de criar/editar papel: select com `Comum / Especial / Adesivo`. Default `Comum`.
- Exibir badge da categoria na linha da tabela de papéis.
- Persistir em `papers.category`.

## 3. Produtos Favoritos (`src/pages/QuotePresets.tsx`)

- `useEffect` que carrega papéis passa a buscar `papers` (não `printing_price_items`) trazendo `name, grammage, category, is_active`. Mantém união por nome (deduplicação atual).
- `paperCategory(name)` é removido; cada `ChipOption` recebe `group` = `papers.category` do cadastro.
- `PAPER_GROUP_LABELS` vira `{ comum: "Papel Comum", especial: "Especial", adesivo: "Adesivo" }` e `PAPER_GROUP_ORDER = ["comum","especial","adesivo"]`.
- Texto do botão "+ Todos deste tipo" continua igual (já existe no `ChipMultiPicker`). Comportamento exatamente como o usuário pediu: marca todos os chips do grupo, chips individuais continuam visíveis e podem ser refinados.
- O resumo no card do preset (`p.papel_inclui.join(", ")`) ganha um modo curto: se um favorito tem **todos** os papéis de uma categoria marcados, mostra "papel: Especial (todos)" em vez da lista enorme. Caso contrário, mostra os primeiros 3 nomes + "+N".

## 4. Filtragem no orçamento (`src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`)

Hoje os favoritos aparecem todos lado a lado com "Personalizado". A regra de filtragem por papel **não estava ativa**. Vamos ativar de forma suave:

- Quando o usuário ainda **não escolheu papel** (estado inicial / personalizado vazio): mostra todos os favoritos (igual hoje).
- Quando há papel escolhido em `currentSel.paper_type`:
  - Esconde favoritos cujo `papel_exclui` contém o papel.
  - Dá destaque (badge "sugerido") aos favoritos cujo `papel_inclui` está vazio **ou** inclui o papel atual.
  - Demais ficam atenuados (`opacity-60`) mas continuam clicáveis — não removidos, para evitar surpresa.
- Nenhuma alteração no `productSuggester` (continua sugerindo `banner`, `cartao`, etc. por heurística de tamanho/acabamento).

## 5. Tipos

- `src/components/orcamentos-v3/shared/useQuotePresets.ts`: sem mudança (campos já existem).
- `src/integrations/supabase/types.ts` é regenerado pela migração.

## Arquivos editados

- **Migração** — `papers.category` + backfill.
- `src/pages/MateriasPrimas.tsx` — campo categoria no form + badge na tabela.
- `src/pages/QuotePresets.tsx` — usar `papers` como fonte, novos grupos, resumo enxuto.
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — destaque/atenuação por `papel_inclui`/`papel_exclui` quando há papel selecionado.

## Fora de escopo

- Categoria editável em massa (continua um por um na tela de Papéis).
- Mudar shape de `quote_presets.papel_inclui` para guardar categorias (mantemos nomes para precisão).
- Aplicar mesma lógica em CV — só Impressão.

## Validação manual

1. Migrar e abrir **Papéis & Suprimentos**: cada papel mostra categoria (default Comum); admin reclassifica os adesivos e couchês.
2. Em **Produtos Favoritos**: dialog mostra 3 grupos (Papel Comum, Especial, Adesivo); botão "+ Todos deste tipo" preenche chips do grupo.
3. Criar favorito "Folheto Couchê" marcando "+ Todos deste tipo" em **Especial**.
4. No **novo orçamento (Impressão)**: sem papel escolhido → todos os favoritos visíveis. Ao escolher um papel Especial, o favorito vira "sugerido"; ao escolher um Adesivo, o mesmo favorito fica atenuado.
