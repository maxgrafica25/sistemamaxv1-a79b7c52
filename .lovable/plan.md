
# Reorganização: Etapas de Produção + Papéis & Suprimentos

## Objetivo

Hoje o conteúdo "como produzir" está espalhado entre `/processos-producao` (etapas + categorias) e `/insumos` (grupos de materiais + kits de produto). Vamos consolidar tudo que é "engenharia/montagem" num único hub e deixar o outro módulo só com o cadastro físico de papéis e suprimentos.

## Resultado final no menu lateral

**Catálogo:**
- **Papéis & Suprimentos** (antigo "Insumos") → ícone `Package`
  - Aba **Papéis**
  - Aba **Suprimentos**
- **Contatos**
- **Equipamentos**
- **Comunicação Visual**

**Precificação:**
- Preço Impressão
- Acabamentos
- Calc. Etiquetas
- **Etapas de Produção** (antigo "Processos de Produção") → ícone `Factory`
  - Aba **Etapas** (atual)
  - Aba **Categorias** (atual)
  - Aba **Grupos de Etapas** (movida de `step_groups`, hoje editada inline em Etapas)
  - Aba **Grupos de Materiais** (vinda do Insumos)
  - Aba **Kits de Produto** (vinda do Insumos)

## Mudanças por arquivo

### Sidebar (`src/components/Sidebar.tsx`)
- Renomear `"Insumos"` → `"Papéis & Suprimentos"` (href continua `/insumos` para não quebrar links salvos).
- Renomear `"Processos de Produção"` → `"Etapas de Produção"`.

### Página Insumos (`src/pages/Insumos.tsx`)
- Remover abas **Grupos** e **Kits de Produto** — manter apenas **Papéis** (atual `Materiais`) e **Suprimentos**.
- Atualizar `TABS`, título da página/header e o `useSearchParams` (default vira `papeis`).
- Os redirects atuais (`/materias-primas`, `/grupos-materiais`, `/kits-produto`) passam a apontar para a aba correta dentro de `/processos-producao` (ver App.tsx).

### Página Processos (`src/pages/ProcessosProducao.tsx`)
- Adicionar duas novas abas além das existentes:
  - **Grupos de Etapas** → usa a tabela `step_groups` (já existente). Componente novo `StepGroupsTab.tsx` com CRUD básico (nome + cor opcional, igual padrão de Categorias).
  - **Grupos de Materiais** → reaproveita o componente `GruposMateriais` existente, importado como aba (sem alterar lógica).
  - **Kits de Produto** → reaproveita o componente `KitsProduto` existente como aba, mantendo o botão "Novo Kit" no header da aba (via ref, igual ao Insumos faz hoje).
- Reordenar abas: `Etapas · Categorias · Grupos de Etapas · Grupos de Materiais · Kits de Produto`.

### Roteamento (`src/App.tsx`)
- Manter `/insumos` ativo (só com 2 abas agora).
- Atualizar redirects:
  - `/grupos-materiais` → `/processos-producao?tab=grupos-materiais`
  - `/kits-produto` → `/processos-producao?tab=kits`
  - `/materias-primas` continua → `/insumos`

### Command Palette (`src/components/CommandPalette.tsx`)
- Conferir e atualizar quaisquer entradas que digam "Insumos", "Processos de Produção", "Grupos de Materiais" ou "Kits de Produto" para os novos nomes/rotas.

## Fora de escopo (não muda)

- **Banco de dados:** nenhuma migration. Tabelas `step_groups`, `material_groups`, `product_kits`, `production_steps` continuam exatamente como estão.
- **Permissões/RLS:** inalteradas (Admin continua sendo quem edita).
- **Lógica de orçamentos, pricing, kits:** zero mudança — só estamos movendo telas de lugar.

## Pontos de atenção

- `KitsProduto` já expõe `KitsProdutoHandle` com `openNew()` via ref — vamos reaproveitar exatamente como o Insumos faz hoje, só que dentro da nova aba.
- O componente de aba (`DotTabs`) hoje tem 3 abas no Insumos; vai pra 5 no Processos — verificar se o layout horizontal continua confortável em 1067px (viewport atual do usuário). Se ficar apertado, usar wrap natural do componente.
- Memória do projeto (`mem://features/production` e `mem://features/inventory`) será atualizada após a aprovação refletindo a nova organização.
