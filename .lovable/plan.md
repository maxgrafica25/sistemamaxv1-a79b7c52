## Objetivo

Tornar a opção **Personalizada** mais evidente em Capa/Contracapa do Kit Apostila e, depois que o usuário escolher o papel, colapsar o editor mostrando um resumo visual (no mesmo tom roxo do bloco do Kit) do que foi configurado — clicável para reabrir e editar.

## Mudanças

### 1. Toggle Padrão/Personalizada mais evidente (`BookletKitPanel.tsx`)

Hoje o `Tabs` aparece bem pequeno (h-5, text-[10px]) e fica fácil passar batido.

- Aumentar o toggle: `h-7`, fonte `text-[11px]`, padding maior nos triggers.
- Adicionar microcopy à direita do toggle quando em modo Padrão: `"← clique em Personalizada para usar impressão (ex.: Couchê 300g + laminação)"` em `text-[10px] text-muted-foreground italic`, visível só quando `mode === "standard"`. Some quando o usuário troca para Personalizada (não polui).
- Quando `mode === "custom"` e ainda **sem papel escolhido**, mostrar um badge âmbar suave: `"Configure abaixo ↓"` para guiar.
- Trocar o `TabsTrigger "Personalizada"` por um visual mais "ativável": ícone `Sparkles` pequeno + texto, com `data-[state=inactive]` em cor `primary/70` (em vez de muted) para sinalizar que é uma ação interessante.

### 2. Colapsar editor após escolha + resumo roxo (`CustomCoverEditor.tsx` + `BookletKitPanel.tsx`)

Estado novo em `BookletKitPanel`: `coverCollapsed: boolean` e `backCoverCollapsed: boolean` (default `false`).

Fluxo:
- Modo Personalizada + papel ainda não escolhido → editor aberto (igual hoje).
- Assim que o `CustomCoverEditor` reporta um `V3PrintItem` válido (via `onChange`), o painel **automaticamente colapsa** o editor (`setCoverCollapsed(true)`).
- No lugar do editor, renderizar um **chip resumo roxo** logo abaixo da linha da capa, no mesmo estilo do bloco principal do Kit (`border-primary/30 bg-primary/[0.03]`):

```text
[✨ Capa personalizada] Couchê 300g · A4 · F/V · + Laminação BOPP brilhante   R$ 8,20   [Editar]
```

  - Ícone `Sparkles` em `text-primary`.
  - Descrição = mesma string já gerada em `desc` do V3PrintItem (papel + tamanho + face + acabamentos).
  - Subtotal já calculado (`valor_unitario × quantidade`) em `tabular-nums`.
  - Botão `Editar` (ghost, `h-6`, ícone `Pencil`) → `setCoverCollapsed(false)` reabre o editor com os valores preservados.
- Se o usuário trocar de papel/acabamento dentro do editor reaberto, ao fechar (botão "Concluir" no rodapé do editor, novo) volta a colapsar.
- Se trocar o toggle de volta para **Padrão**, reseta `coverCollapsed = false` e descarta `customCover`.

### 3. Editor com botão "Concluir" (`CustomCoverEditor.tsx`)

Adicionar um rodapé com botão `Concluir` (size sm, variant default) — visível apenas quando há um `item` válido. Recebe nova prop opcional `onDone?: () => void` que o painel usa para colapsar manualmente. Não muda nada se `onDone` não for passado (componente continua reutilizável).

## Fora de escopo

- Não mexe em pricing, finishing engine, miolo, outras formas (Cartão/Folheto/Etiqueta).
- Não persiste a capa personalizada como preset reutilizável.
- Não altera o chip-resumo do miolo nem o Resumo Financeiro.

## Arquivos

- `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` — toggle destacado, microcopy, estado collapsed, chip-resumo roxo.
- `src/components/orcamentos-v3/forms/CustomCoverEditor.tsx` — prop `onDone` + botão Concluir.
