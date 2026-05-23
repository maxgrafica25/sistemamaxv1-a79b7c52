
# Categorias como configuração do módulo Produção

## Mudanças

### 1. `src/pages/ProcessosProducao.tsx`
- Remover `"categorias"` da config de abas.
- Adicionar botão de engrenagem (`Settings` do lucide) no header, ao lado direito do título — visível em todas as abas, restrito a Admin via `AdminOnly`.
- Estado local `categoriasOpen` controlando um `<Dialog>` que renderiza `<CategoriasTab />` dentro.
- Nova ordem das abas: **Etapas · Acabamentos · Grupos de Etapas · Grupos de Materiais · Kits de Produto**
- Manter compatibilidade: se a URL chegar com `?tab=categorias`, abrir o dialog automaticamente e cair na aba default (`etapas`).

### 2. `src/pages/processos-producao/CategoriasTab.tsx`
- Aceitar prop `hideHeader?: boolean` (mesmo padrão dos outros) caso já tenha header próprio; senão, sem mudança.

### 3. Botões de ação no header
- Header passa a ter: título + descrição (esquerda) e, à direita, agrupados:
  - Engrenagem ⚙ (sempre visível para admin) → abre dialog de Categorias
  - Botão "Novo Kit" (apenas quando aba `kits` ativa, como já é hoje)

## Fora de escopo

- Nenhuma migration. Tabela `production_step_categories` continua igual.
- Lógica de uso das categorias em `StepTypeBadge`, `EtapasTab` Select etc. inalterada.
