# Ajustes no formulário Cartão de Visita (V3)

Arquivo único: `src/components/orcamentos-v3/forms/BusinessCardForm.tsx`.

## O que muda

### 1) "Ajustar layout da folha" sobe para o topo
Hoje o bloco colapsável fica no final, depois do preço — o usuário só descobre as opções de folha/cartão depois de já ter visto o resultado. Vou movê-lo para logo após o seletor de **Face de impressão**, ainda colapsado por padrão (para não poluir), mas visível antes do "Resumo de aproveitamento" e do preço. Assim a sequência fica:

```
Catálogo selecionado
Quantidade
Face de impressão
Ajustar layout da folha       ← novo lugar (colapsado)
Resumo de aproveitamento
Preço por folha / por cartão
Acabamentos (fixos)
Acabamentos opcionais
[Adicionar ao orçamento]
```

### 2) Acabamentos opcionais ficam listados (não escondidos atrás de "Sugestões opcionais")
Hoje os opcionais ficam dentro de um `<details>` chamado "Sugestões opcionais" — pelo nome do grupo o usuário não consegue ver o que está sendo contemplado. Vou:

- Trocar o `<details>` por um `<Field label="Acabamentos opcionais">` com a mesma lista (`FinishingProgressive`) sempre visível.
- Manter um subtítulo curto (ex.: "Marque para incluir no orçamento") para reforçar que são opt-in.

### 3) Opcionais começam SEMPRE desmarcados
No `useEffect` que inicializa `finEnabled` (linhas ~165-175), hoje os opcionais com `default_on=true` vêm pré-marcados. Vou remover esse pré-marque para opcionais — somente os `fixed` continuam marcados automaticamente. Opcional = opcional, o usuário decide.

## Detalhes técnicos

- Em `BusinessCardForm.tsx`: extrair o JSX do bloco "Layout editável (colapsado)" e movê-lo para depois do `<Field label="Face de impressão">`.
- Substituir o `<details>` de "Sugestões opcionais" por um `<Field>` padrão renderizando `FinishingProgressive` com `optionalFinishes`.
- No `useEffect` de inicialização de `finEnabled`: remover o ramo `else if (p.default_on) next[p.key] = true;` (que só se aplicava a opcionais).
- Nenhuma mudança em outros arquivos (PrintForm, ProductKitPanel, etc.) — o problema é específico do fluxo Cartão de Visita visualizado pelo usuário.

## Fora de escopo
- Não mexer no `ProductKitPanel` (já lista item-a-item).
- Não alterar lógica de preço, descrição, ou tipos.
