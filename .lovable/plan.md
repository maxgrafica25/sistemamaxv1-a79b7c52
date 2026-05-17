# Espelho Suprimentos CV ↔ Suprimentos Geral

Suas escolhas — **bidirecional automático, espelhar tudo, lançar nos dois lados** — descrevem na prática **um único registro aparecendo em dois lugares**. Vou implementar exatamente isso: zero duplicação de dados, mas duas "portas de entrada" idênticas (CV e Geral), cada uma com a cara do seu módulo.

Por que não duplicar fisicamente: dois registros sincronizados sempre acabam desalinhando (trigger falha, race condition, alguém edita direto no banco). Um registro com flag `cv` resolve todos os requisitos sem essa dívida.

## O que muda para o usuário

- Aba nova **"Suprimentos CV"** dentro de `/cadastros-cv`, ao lado de Mídias / Impressões / Acabamentos.
- Lista, formulário, histórico de preço, fornecedor, estoque — **idênticos** ao módulo Matérias-Primas, mas só mostra itens marcados como CV.
- Em **Matérias-Primas geral**, ganha um filtro/chip `Módulo: Todos · Gráfica · CV` no topo.
- Cadastrar/editar em qualquer um dos dois lados altera o mesmo registro. Lançamento de NF idem.
- Toggle `Visível no CV` no formulário — marca/desmarca a flag.
- Acabamentos CV (receitas) continuam apontando para `supplies.id` direto. Atualização de preço aparece **instantaneamente** nos dois módulos e no cálculo da calculadora.

## Mudanças técnicas

### Banco
- Adicionar coluna `supplies.modulo text[] not null default '{grafica}'` (array para suportar `{grafica,cv}` quando o item serve aos dois — ex.: lâmina de estilete).
- Índice GIN em `supplies.modulo` para filtros rápidos.
- Migração de dados: itens hoje usados em `cv_calc_acabamento_recipe_items` recebem `cv` adicionado ao array automaticamente.
- Nada de trigger de sincronização — não há o que sincronizar.

### Frontend
- Nova aba `SuprimentosCVTab.tsx` em `src/components/cv-calc/` que **reutiliza** o componente de lista/form de `MateriasPrimas.tsx`, passando `defaultModulo="cv"` e `filterModulo="cv"`.
- `MateriasPrimas.tsx`: adiciona filtro de módulo no header (default Todos).
- Form de supply: checkboxes `Gráfica` / `Comunicação Visual` (multi). Default depende de onde foi aberto.
- Registrar a aba em `CadastrosCV.tsx` (rota atual `/cadastros-cv`).

### Acabamentos CV — receita
- No `AcabamentosTab.tsx`, o picker de supply passa a filtrar `modulo @> '{cv}'` por padrão, com um link "ver todos" para casos raros.

## O que **não** muda
- Estrutura de receitas (`cv_calc_acabamento_recipe_items`), engine de cálculo, histórico de preço, fornecedores — tudo intacto.
- Nenhum dado existente é apagado nem duplicado.

## Resultado prático para a sua dor

| Você queria | Como atende |
|---|---|
| Administração isolada de CV | Aba dedicada, só mostra itens CV |
| Cadastrar/editar nos dois lados | Sim, ambos abrem o mesmo registro |
| Bidirecional automático | Trivial: é o mesmo registro |
| Espelhar tudo (preço, fornecedor, estoque, histórico) | Garantido por design |
| Lançar NF nos dois | Sim, é o mesmo fluxo de compra |

Se aprovar, executo a migração e os componentes em sequência.
