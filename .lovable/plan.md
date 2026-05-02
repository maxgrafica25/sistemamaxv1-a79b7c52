## Objetivo

Tornar **todo o sistema** responsivo, garantindo que em qualquer tamanho de tela (mobile ~360px, tablet ~768px, laptop ~1024px, desktop ≥1400px) o usuário consiga visualizar e operar todas as informações sem perda de conteúdo.

## Diagnóstico atual

Após varredura no projeto, identifiquei 4 problemas recorrentes:

1. **Tabelas largas sem scroll horizontal** — 15 páginas com `<Table>` (Materiais, Despesas Fixas, Equipamentos, Pedidos, Clientes, Fornecedores, Auditoria, etc.) que estouram em telas menores que 1280px.
2. **Dialogs/Modais sem altura/largura responsivas** — 42 arquivos com `DialogContent`. Muitos usam `max-w-3xl`/`max-w-lg` sem `max-h-[90vh] overflow-y-auto`, fazendo o conteúdo ser cortado verticalmente em telas baixas (visível no print enviado: dialog "Novo Item" cobrindo a tela inteira).
3. **Padding fixo grande** (`p-6`) em ~20 páginas, desperdiçando espaço útil em telas médias/pequenas.
4. **Headers com botões/filtros sem `flex-wrap`** quebrando em mobile.

## Estratégia: padrões reutilizáveis em vez de retrabalho página a página

Em vez de editar cada componente manualmente, vou:

### Fase 1 — Padrões globais (efeito amplo, baixo risco)

1. **`src/components/ui/dialog.tsx`**: ajustar `DialogContent` padrão para incluir `max-h-[90vh] overflow-y-auto` e padding responsivo (`p-4 sm:p-6`). Isso corrige automaticamente os 42 dialogs do sistema.

2. **`src/components/ui/table.tsx`**: o componente `Table` já vem dentro de um wrapper `<div className="relative w-full overflow-auto">` (shadcn padrão). Confirmar que está ativo e adicionar classe utilitária.

3. **Helper de página `PageContainer`** (novo, opcional): componente leve em `src/components/PageContainer.tsx` com padding/largura responsivos padronizados (`p-3 sm:p-4 lg:p-6 max-w-[1400px] mx-auto`). Usado nas próximas refatorações sem precisar mexer em todas hoje.

### Fase 2 — Páginas de alto tráfego (impacto visível imediato)

Aplicar wrapper `overflow-x-auto` + padding responsivo nas páginas que o usuário usa diariamente:

- `Pedidos.tsx` (kanban + tabela)
- `OrcamentosV2.tsx` (lista de orçamentos)
- `ContasReceber.tsx`
- `MateriasPrimas.tsx` (4 tabelas)
- `Equipamentos.tsx`
- `Clientes.tsx` / `Fornecedores.tsx`
- `DespesasFixas.tsx` (3 tabelas)
- `Cadastros.tsx` / `CadastrosCV.tsx`
- `Acabamentos.tsx`
- `Auditoria.tsx`
- `LeituraImpressoras.tsx`
- `Monitoramento.tsx`
- `Usuarios.tsx`
- `ProcessosProducao.tsx` / `GruposMateriais.tsx` / `GruposEtapas.tsx`
- `Dashboard.tsx` (cards do grid)

Para cada uma:
- Container raiz: `p-6` → `p-3 sm:p-4 lg:p-6`
- Headers com ações: garantir `flex-wrap gap-2`
- Tabelas: envolver em `<div className="w-full overflow-x-auto rounded-md border">` quando ainda não tiver
- Tabs com muitas abas: wrapper `overflow-x-auto`

### Fase 3 — Sidebar e Layout

- Confirmar que `Sidebar` colapsa corretamente em mobile (já existe `useSidebarState` com `mobileOpen` — verificar funcionamento).
- Header: garantir que avatar/nome/notificações se adaptem (`hidden sm:inline` onde necessário).

### Fase 4 — Editores complexos

Páginas com formulários grandes em uma só tela:
- `NewQuoteV2` / `EditQuoteV2` (orçamentos): garantir que a `StickyFinancialSidebar` (já tem versão mobile bottom-bar) funcione bem.
- `OrderEditorDialog`, `PrintingItemEditor`: ajustar grids `grid-cols-3` para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`.
- `LabelLayoutCalculator`: já tem dialog responsivo, validar.

## Detalhes técnicos

### Padrão de tabela responsiva

```tsx
<div className="w-full overflow-x-auto rounded-md border">
  <Table className="min-w-max">
    {/* ... */}
  </Table>
</div>
```

### Padrão de dialog responsivo (no `dialog.tsx`)

```tsx
<DialogPrimitive.Content
  className={cn(
    "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%]",
    "max-h-[90vh] overflow-y-auto", // <- adicionar
    "gap-4 border bg-background p-4 sm:p-6 shadow-lg", // <- p-4 sm:p-6
    "duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out ...",
    className
  )}
/>
```

### Padrão de container de página

```tsx
<div className="p-3 sm:p-4 lg:p-6 space-y-4 lg:space-y-6 max-w-[1400px] mx-auto">
```

### Padrão de header de página

```tsx
<div className="flex items-start justify-between flex-wrap gap-3">
  <div className="min-w-0">...</div>
  <div className="flex gap-2 flex-wrap">...</div>
</div>
```

## O que fica fora deste plano

- **Redesenho visual** das páginas (cores, hierarquia, layouts novos) — não é o pedido.
- **PWA / app nativo** — apenas responsividade web.
- **Componentes de relatório/PDF** (`production-pdf.ts`, `production-order-pdf.ts`) — saídas para impressão, não tela.

## Validação

Após as mudanças, vou abrir o navegador embutido em três viewports (1440px, 1024px, 390px) navegando pelas páginas mais críticas (Pedidos, Orçamentos V2, Materiais, Preço Impressão, Equipamentos, Dashboard, Despesas Fixas, Contas a Receber) e tirar screenshots para confirmar que nada está cortado.

## Estimativa

Mudança em ~25 arquivos, sem risco para lógica de negócio (apenas classes Tailwind). O impacto da Fase 1 (dialog.tsx) sozinho já resolve grande parte dos problemas.
