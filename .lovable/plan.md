# Padrão único de cabeçalho de página

Hoje a maioria das páginas já segue um padrão parecido, mas com pequenas divergências (tamanhos de título, ícones, espaçamentos, container) que fazem o usuário "perceber" a inconsistência. Vou consolidar isso em **um único componente** e aplicar em todas as páginas.

## A âncora visual (padrão único)

Sempre no mesmo lugar e com o mesmo peso, em todos os módulos:

```
┌─────────────────────────────────────────────────────────────┐
│  [ícone roxo]  Título do Módulo            [CTA opcional]   │  ← H1 24px bold
│  Subtítulo curto descrevendo o módulo                       │  ← 14px muted
│  ─────────────────────────────────────────────────────────  │  (separador opcional)
└─────────────────────────────────────────────────────────────┘
```

**Regras fixas (memória do projeto):**
- `h1` = `text-2xl font-bold text-foreground`, com `Lucide icon` à esquerda em `h-6 w-6 text-primary`.
- Subtítulo = `text-sm text-muted-foreground mt-1`, opcional mas recomendado.
- Container = sempre `PageContainer` (que já existe), com `maxWidth="default"` (1400px) ou `"wide"` (1600px) para kanban.
- Ações de página (botões "Novo X", filtros globais) ficam alinhadas à direita do header, na mesma linha do título, com `flex items-start justify-between`.
- Conteúdo abaixo do header herda o `space-y` do `PageContainer` — sem margens manuais.

**Hierarquia complementar (já será aplicada por consequência ao usar o componente, mas vale registrar):**
- Section headers dentro da página (ex.: "Produtos favoritos", "Faixas de quantidade") = `text-sm font-semibold text-foreground` + opcional `border-b` sutil.
- Field labels = `text-xs uppercase tracking-wide text-muted-foreground font-medium`.
- Roxo (`text-primary`) é exclusivo: ícone do módulo no header, CTAs primários e estados ativos. Nada mais.

## O componente

Criar `src/components/PageHeader.tsx`:

```tsx
interface PageHeaderProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;     // botões à direita
  meta?: ReactNode;        // linha extra abaixo do subtítulo (badges, stats)
}
```

Layout interno fixo: `flex items-start justify-between gap-4 flex-wrap` + bloco título/subtítulo à esquerda + `actions` à direita.

## Aplicação (todas as páginas)

Substituir o `<h1>...</h1>` cru em cada página por `<PageHeader icon={...} title="..." description="..." actions={...} />`. Páginas a tocar:

`Dashboard`, `Pedidos`, `Orçamentos (V3)`, `ContasReceber`, `DespesasFixas`, `PrecoImpressao`, `CalculadoraEtiquetas`, `Equipamentos`, `Acabamentos`, `MateriasPrimas`, `Insumos`, `Produtos`, `KitsProduto`, `QuotePresets`, `Cadastros`, `CadastrosCV`, `GruposMateriais`, `ProcessosProducao`, `Monitoramento`, `Configuracoes`, `Auditoria`, `Usuarios`, `Chat`.

Outliers que serão **normalizados** para o padrão:
- `Configuracoes` (hoje `text-xl` + ícone `h-5 w-5`) → vira `text-2xl` + `h-6 w-6`.
- `Monitoramento` (hoje `text-3xl`) → vira `text-2xl`.
- `KitsProduto` (hoje sem ícone roxo, `font-semibold`) → ganha ícone roxo + `font-bold`.
- `Produtos` (hoje ícone sem `text-primary`) → ícone ganha `text-primary`.
- `CalculadoraEtiquetas` / `Acabamentos` (hoje com `tracking-tight`) → sem `tracking-tight`, fica igual ao resto.
- Páginas que usam `p-... max-w-[1400px] mx-auto` cru → passam a usar `PageContainer`.

## Fora de escopo

- Não vou redesenhar conteúdo interno (tabelas, cards, formulários) nesta passada — só o **cabeçalho** e o **container** de cada página. Isso já elimina a "adivinhação" sem virar refatoração gigante.
- Sem mudança de cores do design system, só uso disciplinado dos tokens existentes.
- Cabeçalhos internos de telas especiais (ex.: editor de orçamento V3 com barra própria de "Voltar / Cliente / Salvar") ficam como estão — não são página de módulo, são editor.

## Passos técnicos

1. Criar `src/components/PageHeader.tsx` com a API descrita.
2. Atualizar `mem://style/design` com a regra do cabeçalho-padrão para que valha em qualquer feature futura.
3. Varrer as 23 páginas listadas, substituindo o bloco de header e (quando faltar) envolvendo o conteúdo em `PageContainer`.
4. Conferir no preview que Dashboard, Pedidos, Orçamentos, Configurações e Monitoramento (os mais divergentes hoje) ficaram com o mesmo "olhar".
