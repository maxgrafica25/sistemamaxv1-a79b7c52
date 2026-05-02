## Objetivo

Hoje, na Calculadora de Etiquetas, o usuário escolhe **Impressão** e **Acabamento** separadamente, mesmo quando a relação é óbvia (papel adesivo → recorte de adesivo; papel especial → recorte de especial). Vamos automatizar essa ligação para tornar o orçamento praticamente "1 clique".

## O que muda na tela

No card "Cálculo do orçamento":

- Quando o usuário seleciona um item de **Impressão** (ex.: "Adesivo Brilho 90g · A3 · F · color"), o sistema **escolhe automaticamente o acabamento correspondente** ("Recorte Folhas Adesivas") e atualiza o "Total por folha" sem extra clique.
- O campo de Acabamento continua editável — se a sugestão automática não servir, o usuário pode trocar manualmente.
- A escolha manual passa a ser lembrada **por papel + tamanho de folha** (e não só por tamanho como hoje), para que da próxima vez o sistema respeite a preferência do usuário para aquele papel.
- Pequena etiqueta "auto" aparece ao lado do select de Acabamento quando a sugestão veio do mapeamento automático, para deixar claro que pode ser trocado.

## Como o sistema decide o acabamento

Mapeamento por palavra-chave do nome do papel (case-insensitive), usando o que já existe no cadastro:

```text
papel contém "adesiv"     → "Recorte Folhas Adesivas"
qualquer outro papel      → "Recorte Folhas Papéis Especiais"
sem match / sem cadastro  → "Sem acabamento" (comportamento atual)
```

A correspondência é feita pelo **nome** do acabamento já cadastrado (ex.: contém "adesiv" no nome), no mesmo `size` da folha selecionada. Assim, novos acabamentos cadastrados com a mesma convenção entram automaticamente no esquema, sem precisar mexer em código.

## Fluxo

```text
Usuário troca papel
        │
        ▼
useFolhaPricing detecta nova seleção de Impressão
        │
        ▼
Tem escolha salva manual para (papel, tamanho)? ──► sim ─► usa salva
        │ não
        ▼
Aplica heurística por palavra-chave  ──► seta finishingId automaticamente
        │
        ▼
Recalcula Total por folha + folhas necessárias + preço total
```

## Detalhes técnicos

Arquivos afetados:

- **`src/lib/labels/sheet-pricing.ts`**
  - Estender o `ChoiceMap` salvo em `localStorage` para chave composta `${size}::${printingId}` (mantendo retrocompatibilidade — se existir só por size, aceita como fallback).
  - Adicionar função pura `pickDefaultFinishing(printing, finishingOptions)` que aplica a heurística de keyword (`/adesiv/i` → acabamento cujo nome casa com `/adesiv/i`, senão acabamento cujo nome casa com `/especia|especiais/i`, senão `null`).
  - No `useEffect` que reage à mudança de `printingId`: se não houver escolha salva manual para aquele par, chamar `pickDefaultFinishing` e setar via `setFinishingIdState` (sem persistir como manual — flag `auto`).
  - Expor no retorno do hook um booleano `finishingIsAuto` para a UI.

- **`src/components/labels/LabelLayoutCalculator.tsx`** (bloco do select de Acabamento, linhas ~1154–1179)
  - Renderizar badge "auto" pequena quando `folhaPricing.finishingIsAuto` for `true`.
  - Ao usuário trocar manualmente, o hook persiste a escolha por (papel, tamanho) e remove o estado "auto".

Sem migração de banco. Sem mudança nas tabelas `printing_price_items` / `finishings_price_items`.

## Fora do escopo

- Criar uma coluna explícita `default_finishing_id` em `printing_price_items` (ficaria mais robusto, mas exige UI de cadastro e migração — pode ser uma evolução futura caso a heurística por nome não seja suficiente).
- Mudanças no fluxo de orçamentos V2 — a melhoria fica restrita à Calculadora de Etiquetas.
