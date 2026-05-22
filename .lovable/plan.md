## Objetivo

Tornar óbvio em qual categoria do orçamento o usuário está (Impressão + Acabamentos, Com. Visual, Terceirizados, Mão-de-obra, Suprimentos). Hoje as abas em `TabsLayout` usam só uma linha fina embaixo + cor de texto, o que se perde quando o usuário rola, foca no formulário ou alterna rápido entre tabs.

## Mudanças (apenas frontend / UI)

### 1. `src/components/orcamentos-v3/workspace/TabsLayout.tsx`
Reforçar o estado ativo das abas:
- Aba ativa ganha **fundo sutil em `bg-primary/10`**, **texto `text-primary`**, ícone colorido e a barra inferior fica mais grossa (`h-1`) e arredondada.
- Abas inativas mantêm o visual atual (texto `muted-foreground`), com hover mais perceptível (`hover:bg-muted/50`).
- Aumentar levemente o padding horizontal das tabs para acomodar o fundo.
- Manter a tecla de atalho (`Alt+1..5`) visível.

### 2. `src/components/orcamentos-v3/NewQuoteFormV3.tsx`
Adicionar um **cabeçalho contextual** logo abaixo da `TabsLayout` que mostra:
- Ícone + nome da aba ativa em destaque (ex: `🖨 Impressão + Acabamentos`).
- Uma frase curta de contexto por categoria (ex: "Itens impressos no parque próprio", "Mídia grande formato e aplicação", "Serviços executados por terceiros", "Horas técnicas e operacionais", "Insumos e materiais avulsos").
- Cor de fundo suave usando token semântico (`bg-muted/40`, borda `border-border`).

Esse cabeçalho serve como "você está aqui" persistente enquanto o usuário preenche o formulário.

### 3. Constante compartilhada
Mover o array `TABS` (já em `TabsLayout.tsx`) para também expor uma descrição curta por categoria, consumida tanto pelas abas quanto pelo novo cabeçalho contextual — sem duplicar strings.

### Detalhes técnicos
- Apenas Tailwind + tokens do design system (`primary`, `muted`, `border`, `foreground`). Nada de cores hardcoded.
- Sem mudança em lógica de negócio, cálculo, schema ou rotas.
- Responsivo: em telas estreitas o cabeçalho contextual esconde a descrição e mantém só o ícone+título.

## Fora de escopo
- Reordenar tabs, mudar atalhos, mexer nos sub-formulários (PrintForm/CVForm/etc.), engine de cálculo, persistência.

## Validação
- Trocar entre as 5 abas: aba ativa deve ter fundo + cor + barra inferior, e o cabeçalho abaixo deve refletir nome/descrição da categoria.
- Verificar contraste em tema claro e escuro.
- Verificar em 1336px (viewport atual) e em ~768px que o cabeçalho não quebra layout.
