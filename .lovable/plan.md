## Objetivo

Tornar o painel "Kit Encadernação" mais flexível: o kit vira uma sugestão que pode ser usada inteira, parcialmente trocada por impressões personalizadas, ou totalmente substituída por acabamentos livres definidos pelo usuário. O botão de aplicar reflete o que está sendo aplicado.

## Mudanças (arquivo único: `BookletKitPanel.tsx`)

### 1. Slots livres de acabamento personalizado

Adicionar, abaixo das linhas fixas do kit (capa, contracapa, espiral, furação, encadernação), uma seção **"Acabamentos personalizados"** com:

- Botão `+ Adicionar acabamento` (ghost, ícone `Plus`, `text-primary`).
- Cada clique cria um novo slot com um `CustomCoverEditor` (reutilizando o componente existente) + campo de nome opcional (ex.: "Laminação BOPP", "Capa dura", "Folha guarda").
- Cada slot tem:
  - Toggle aberto/colapsado (mesma lógica de capa/contracapa: colapsa para o chip roxo quando o item fica válido).
  - Botão `Remover` (ícone `Trash2`, ghost, `text-destructive`).
- Estado: `extraSlots: Array<{ id: string; label: string; item: V3PrintItem | null; collapsed: boolean }>`.

Os slots livres são incluídos no `apply()` se tiverem `item` válido. Se um slot estiver aberto sem papel escolhido na hora do apply, mostra `toast.error` (mesma regra de capa/contracapa).

### 2. Rótulo dinâmico do botão

Computar `hasAnyCustom`:
```ts
const hasAnyCustom =
  (coverMode === "custom" && !excluded.has("capa")) ||
  (backCoverMode === "custom" && !excluded.has("contracapa")) ||
  extraSlots.length > 0;
```

Botão final:
- `hasAnyCustom === true` → label `"Aplicar acabamentos"`, ícone `Sparkles`.
- `hasAnyCustom === false` → mantém `"Aplicar Kit"` + `Wand2` (comportamento atual).

### 3. Cabeçalho/microcopy

Atualizar o subtítulo do painel para deixar claro que o kit é opcional:
> "Use o kit sugerido, troque itens por impressão personalizada, ou desmarque tudo e adicione apenas os acabamentos que precisar."

### 4. Comportamento de aplicar quando nada do kit está marcado

Hoje, se tudo está desmarcado e não há slots livres → `toast.info("Selecione ao menos um item do kit.")`. Atualizar para:
- Se `items.length === 0` e nenhum slot livre configurado → mensagem `"Adicione ao menos um acabamento ou item do kit."`.
- Se houver apenas slots livres válidos → aplica normalmente (sem o `spiralDiameter` no toast).

## Fora de escopo

- Nenhuma mudança em `CustomCoverEditor.tsx`, `BookletForm.tsx`, `bookletKit.ts`, lógica de preço, ou catálogo.
- Sem persistência/preset de acabamentos favoritos.
- Sem novos campos no `V3Item` — slots livres usam o mesmo `V3PrintItem` que capa/contracapa.

## Arquivos tocados

- `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` (único).
