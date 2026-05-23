## Objetivo

Hoje, em **Processos de Produção → Vincular a Favoritos**, todo vínculo aparece como chip "fixo" de acabamento no formulário de Cartão de Visita. Você quer separar em **dois grupos**:

1. **Fixos / recomendados** — sempre aparecem, marcados por padrão (já implementado).
2. **Sugestões opcionais** — aparecem em uma seção secundária ("Adicionar acabamento opcional"), desmarcados, para o vendedor incluir só quando o cliente pedir (ex.: laminação, verniz localizado, hot stamping).

## Forma mais inteligente: campo `link_type` no vínculo

Em vez de criar uma segunda tabela, adiciono uma coluna **`link_type`** em `product_preset_processes` com dois valores:

- `fixed` — comportamento atual (chip já visível, marcado por padrão).
- `optional` — aparece em seção separada "Sugestões opcionais", desmarcado.

Default: `fixed` (mantém o que já existe).

### Por que essa abordagem

- Reaproveita 100% da tabela e do hook `useProductPresetProcesseses` — só ganha um campo.
- Admin escolhe o tipo na hora de vincular, sem precisar gerenciar duas listas paralelas.
- Permite no futuro adicionar outros tipos (ex.: `default_on` = opcional mas pré-marcado) sem refactor.

## O que muda

### 1. Banco
- `ALTER TABLE product_preset_processes ADD COLUMN link_type text NOT NULL DEFAULT 'fixed' CHECK (link_type IN ('fixed','optional'))`.
- Registros antigos viram `fixed` automaticamente.

### 2. Tela de gestão (`ProductPresetLinksTab.tsx`)
- No card de cada favorito, separar a lista em **dois blocos**: "Fixos" e "Opcionais", cada um com seu próprio "+ Etapa / + Grupo".
- Cada item exibe um badge sutil (Fixo / Opcional) e um toggle rápido para mover entre os dois.

### 3. Hook (`useProductPresetProcesses.ts`)
- Retornar `{ fixedSteps, fixedGroups, optionalSteps, optionalGroups, loaded }` (ou um único array com `link_type` em cada item — prefiro o segundo, mais simples para o form decidir).

### 4. `BusinessCardForm.tsx`
- Seção **"Acabamentos"** (atual): só itens `fixed`, marcados por padrão como hoje.
- Nova seção **"Sugestões opcionais"** abaixo, recolhível (`<details>` ou um chip "+ Adicionar acabamento opcional"): lista os `optional` com switch desligado. Quando ligados, entram no cálculo igual aos fixos.
- Se não houver opcionais cadastrados, a seção não aparece.

## Fora de escopo

- Não mexer em outros formulários (Folheto, Apostila etc.) — eles consomem o mesmo hook e ganham o comportamento automaticamente quando forem migrados, mas o form ajustado nesta rodada é só o de Cartão de Visita.
- Sem reordenar processos por arrastar — mantém o `sort_order` atual.

## Validação

1. Em Processos de Produção → Cartão de Visita: marcar a "Laminação" como **Opcional** e deixar as 2 etapas + 1 grupo como **Fixas**.
2. Em `/orcamentos-v3/novo` → Cartão de Visita: ver os 3 acabamentos fixos marcados e uma seção "Sugestões opcionais" com Laminação desligada.
3. Ligar Laminação → preço atualiza; desligar → volta ao valor anterior.
