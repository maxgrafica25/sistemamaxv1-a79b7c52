
## O que vamos fazer

Três melhorias pequenas e independentes na tela **Acabamentos** + drawer **Faixas por quantidade**.

---

### 1. Botão "Clonar acabamento" (na tabela de Acabamentos)

**Onde:** coluna **Ações** da tabela em `/acabamentos`, ao lado de Faixas / Editar / Excluir. Ícone `Copy` (Lucide).

**Comportamento:**
- Clica → abre `ConfirmDialog` "Clonar 'Recorte Folhas Adesivas'?" com input para o **novo nome** (default: `"<nome original> (cópia)"`).
- Confirma → insere novo registro em `finishings_price_items` copiando **todos os campos** (categoria, tamanho, preço base, ativo) com o novo nome.
- Em seguida, **copia também as faixas** de `finishing_price_tiers` apontando para o novo `finishing_id` (preserva label, min, max, preço, sort_order).
- Toast: *"Acabamento clonado — ajuste os preços nas faixas"* e refetch da lista.

**Por quê:** seu caso de uso (TP1/TP2/TP3/TP4 já configurados, só muda o preço por tipo de recorte) fica resolvido em 2 cliques em vez de redigitar 4 faixas.

---

### 2. Auto-preencher **Mín** da próxima faixa em `FinishingTiersDrawer`

**Regra atual:** ao clicar "Adicionar faixa", o Mín já é calculado como `lastMax + 1` (isso já existe). **O problema** é que se o usuário **edita o Máx de uma faixa intermediária**, o Mín da seguinte **não acompanha**.

**Mudança:**
- Ao alterar `max_qty` de uma faixa, se a faixa seguinte tiver `min_qty === max_qty_anterior + 1` (encadeamento padrão), atualizar automaticamente o `min_qty` da próxima para o novo `max + 1`.
- Detecção: comparar com o valor antigo; se a próxima estava "colada", segue colada. Se o usuário criou um gap manualmente, respeitar.
- Última faixa (sem Máx = ∞) não precisa de ajuste.

**Resultado:** preencher TP1 (1–20) já deixa TP2 começando em 21 sem digitação.

---

### 3. Rótulos automáticos — padrão **TP1, TP2, TP3…**

Sua convenção (TP = Tabela de Preço) é boa: curta, ordinal, neutra (não amarra a um número de folhas que pode mudar). Vamos adotar como padrão.

**Mudança em `autoLabel()`:**
- Hoje gera `"1-20"` / `"21+"` (range numérico).
- Novo padrão: `"TP{n}"` onde `n` = `sort_order + 1`. Ex.: TP1, TP2, TP3, TP4.
- Mantém a regra existente: se o usuário digitou um rótulo customizado, **não sobrescreve**. Só auto-preenche enquanto o rótulo estiver no formato padrão (regex atualizada para `/^TP\d+$/` ou range antigo).
- Adicionar **placeholder** sutil no input mostrando o range atual: `placeholder="TP1 (1–20)"` — assim o usuário vê o range sem ele virar parte do rótulo.

**Migração suave:** acabamentos existentes com labels `"1-10"` continuam funcionando — só novas faixas adicionadas pegam o padrão TP{n}.

---

## Detalhes técnicos

**Arquivos editados:**
- `src/pages/Acabamentos.tsx` — adiciona botão Clone na coluna Ações + handler que chama duas inserts (`finishings_price_items` + `finishing_price_tiers`).
- `src/components/acabamentos/FinishingTiersDrawer.tsx` — atualizar `autoLabel`, ajustar `updateTier` para propagar `max → next.min` quando encadeado, atualizar texto de exemplo no info-box pra usar TP1/TP2/TP3.

**Sem migração de banco** — só lógica de UI e dois inserts adicionais.

**Edge cases:**
- Clonar acabamento sem faixas → só duplica o item base.
- Clonar com nome duplicado → backend não tem unique constraint em `name`, mas vamos sufixar `(cópia)` por padrão pra evitar confusão visual.
- Auto-propagação do Mín: só dispara se a próxima faixa estava exatamente em `oldMax + 1` (encadeamento detectável). Não mexe se houver gap intencional.
