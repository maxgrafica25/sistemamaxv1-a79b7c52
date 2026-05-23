
# Unificar Acabamentos em "Produção"

## Mudanças

### 1. Sidebar (`src/components/Sidebar.tsx`)
- Renomear `"Etapas de Produção"` → `"Produção"` (href continua `/processos-producao`).
- Remover o item `"Acabamentos"` do grupo Precificação.

### 2. Página Produção (`src/pages/ProcessosProducao.tsx`)
- Mudar título visual de `"Etapas de Produção"` → `"Produção"` e ajustar descrição.
- Adicionar aba `"Acabamentos"` na config de tabs.
- Nova ordem: **Etapas · Acabamentos · Categorias · Grupos de Etapas · Grupos de Materiais · Kits de Produto**
- Importar e renderizar `<Acabamentos hideHeader />` quando aba ativa.

### 3. Página Acabamentos (`src/pages/Acabamentos.tsx`)
- Aceitar prop `hideHeader?: boolean` na assinatura do componente.
- Condicionar o `<h1>` + descrição + padding externo da página com base nessa flag (mesmo padrão usado em `GruposMateriais`).
- Componente continua funcionando standalone em `/acabamentos` para o redirect.

### 4. Roteamento (`src/App.tsx`)
- Trocar `<Route path="/acabamentos" element={<Acabamentos />} />` por `<Route path="/acabamentos" element={<Navigate to="/processos-producao?tab=acabamentos" replace />} />`.

### 5. Command Palette (`src/components/CommandPalette.tsx`)
- Trocar label `"Etapas de Produção"` → `"Produção"`.
- (Acabamentos não está no palette hoje — sem mudança lá.)

## Fora de escopo

- Nenhuma migration. Tabela `finishings` e toda a lógica de pricing (`finishing-pricing`, `cv-pricing/engine`, sugestões automáticas, calculadora de etiquetas) ficam intocadas.
- RLS, permissões e fluxos de orçamento sem alteração.

## Ponto de atenção

- A barra de abas vai pra 6 itens (`DotTabs`). No viewport atual (1067px) deve caber em uma linha confortavelmente; se ficar apertado, deixar o wrap natural do componente.
