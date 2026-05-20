## Objetivo

Tornar o painel **Kit de Produto** mais rápido e direto no orçamento, e dar uma solução **cadastrável** para o caso da mola/espiral (item cujo tamanho depende do nº de folhas) — sem voltar a hard-codear regra de apostila.

---

## Parte A — UX do painel no orçamento

Hoje o painel:
- Mostra um kit por vez, com checkboxes/rádios e exige clicar em **"Aplicar Kit"**.
- Não mostra preço total estimado antes de aplicar.
- Trata cada kit como bloco isolado; trocar kit perde escolhas.
- Itens "alternativos" ficam num bloco à parte com layout diferente dos obrigatórios/opcionais, gerando ruído visual.

### Mudanças propostas

1. **Auto-aplicar ao abrir** (toggle por kit, default = ligado):
   - Quando o produto tem exatamente 1 kit ativo, ele é pré-aplicado assim que o usuário digita unidades/folhas.
   - Aparece uma barra discreta no topo do painel: `Kit aplicado: Apostila Padrão · 5 itens · R$ 12,40 — [Desfazer] [Trocar kit ▾]`.
   - Re-aplicar quando units/sheets mudam é automático (debounce).

2. **Linha única e compacta para todo tipo de item** (obrigatório/opcional/alternativo):
   - Esquerda: ícone do tipo (suprimento ⬡ / processo ⏱) + nome.
   - Centro: badge da quantidade resolvida (`120 un`, `8 min`) e descrição curta.
   - Direita: custo + controle de seleção:
     - **Obrigatório** → cadeado (não desmarca).
     - **Opcional** → toggle switch.
     - **Alternativo** → dropdown "Trocar ▾" mostrando as outras opções do grupo (em vez de bloco de rádio separado). Ocupa 1 linha só.
   - Total do kit visível no rodapé do painel em tempo real.

3. **Edição rápida inline** (sem abrir cadastro):
   - Clicar na quantidade resolvida abre um popover: campo numérico + botão "voltar ao automático".
   - Trocar um suprimento por outro do catálogo via `SupplySearch` direto na linha (apenas para itens opcionais/alternativos).

4. **Persistência das escolhas por orçamento**:
   - Se o usuário desmarcou um opcional e depois muda units, a escolha é preservada (só recalcula quantidades).

5. **Quando faltar item no cadastro** (fallback amarelo):
   - Botão "Cadastrar agora" abre o drawer de Materiais/Etapas em modal, e ao salvar o kit re-resolve sem fechar o orçamento.

6. **Múltiplos kits do mesmo produto**:
   - Quando há 2+ kits ativos, vira um Select chip no topo (já existe), mas agora com preview do total ao lado de cada nome no dropdown.

---

## Parte B — Como resolver "espiral conforme nº de folhas" de forma genérica

Hoje existe a fórmula especial `auto_spiral` que chama `getIdealSpiral(sheets)` e procura no catálogo um suprimento cujo nome bata com `espiral … {diâmetro}mm`. Funciona, mas:
- Regra dos intervalos está **hard-coded em código** (`spiral-selector.ts`).
- Só funciona para "espiral"; outros casos parecidos (peso de papel por nº de páginas, tipo de caixa por dimensão, etc.) ficariam sem solução.

### Proposta: **Tabela de variantes por faixa** (cadastrável)

Nova tabela `product_kit_item_variants` ligada a `product_kit_items`:

```text
product_kit_item_variants
- id
- item_id        → FK product_kit_items
- min_value      numeric   (inclusivo)
- max_value      numeric   (inclusivo; null = sem limite)
- supply_id      → FK supplies  (variante a usar nessa faixa)
- label          text      (opcional, ex.: "7mm")
```

E um novo valor para `quantity_formula`: **`variant_by_sheets`** (e mais tarde `variant_by_perimeter_m`, `variant_by_area_m2`, `variant_by_units` reaproveitando a mesma tabela com um campo `match_metric`).

### Como o usuário cadastra (UI no KitsProduto)

Na linha do item, quando escolher `variant_by_sheets`:
- O campo "Suprimento" some.
- Aparece uma mini-tabela editável:

```text
Faixa de folhas      Suprimento
1   - 25             [Espiral 7mm ▾]
26  - 50             [Espiral 9mm ▾]
51  - 70             [Espiral 12mm ▾]
…
351 - ∞              [Espiral 45mm ▾]
```

- Botão "Carregar preset: Espirais padrão" → preenche com a tabela atual do `spiral-selector` (apenas como atalho; depois fica 100% editável).

### Como o engine resolve

Em `productKit.ts` adiciono um caso na função `resolveQty` + lookup do supply:

```text
se item.quantity_formula = 'variant_by_sheets':
  v = item.variants.find(v => sheets >= v.min and (v.max == null or sheets <= v.max))
  supply = v?.supply
  qty = units (1 por unidade, configurável via quantity_value)
```

E `auto_spiral` continua existindo como atalho legado (futuramente migrado).

### Por que essa solução

- **Cadastrável**: cliente cria/edita faixas sem código.
- **Genérica**: serve para qualquer item cujo tipo varie por uma métrica numérica do orçamento.
- **Compatível**: kits antigos com `auto_spiral` continuam funcionando.
- **Transparente no painel**: a linha mostra `Espiral 12mm (faixa 51-70 folhas)` — o usuário entende por que veio aquela escolha e pode trocar pelo dropdown da Parte A.

---

## Arquivos afetados (visão técnica)

1. **Migration**
   - Cria `product_kit_item_variants` + FK.
   - Adiciona `'variant_by_sheets'` à coluna `quantity_formula` (já é text, sem CHECK constraint — apenas tipo TS a atualizar).

2. **`src/components/orcamentos-v3/shared/productKit.ts`**
   - Carrega `variants` junto com os itens (`fetchActiveKitsForProduct`).
   - Adiciona resolver `variant_by_sheets`.

3. **`src/pages/KitsProduto.tsx`**
   - Nova fórmula no dropdown.
   - Sub-editor de faixas (tabela + linha "+ adicionar faixa", botão "Carregar preset espirais").

4. **`src/components/orcamentos-v3/forms/ProductKitPanel.tsx`** (reescrita parcial)
   - Layout de 1 linha por item, dropdown para alternativos, toggle para opcionais.
   - Auto-aplicar com debounce, barra de status no topo, total no rodapé.
   - Persistência local da escolha do usuário (Set de excluded + alt picks) memoizada por kitId.
   - Popover de edição inline de quantidade.

5. **Sem mudança nos forms** (`BookletForm`, `PrintForm`, etc.) — continuam apenas montando o `ProductKitPanel`.

---

## Fora de escopo (agora)

- Outras métricas de variante (perímetro, m², unidades) — deixar o schema pronto, implementar só sheets.
- Editar kit aplicado dentro de orçamentos antigos.
- Remover `auto_spiral` (mantém por compatibilidade; podemos migrar dados depois).

---

## Sequência sugerida

1. Migration `product_kit_item_variants` + formula nova.
2. Engine `productKit.ts` (resolver + fetch).
3. UI do cadastro (KitsProduto) com sub-editor de faixas + preset.
4. Reescrita do `ProductKitPanel` (auto-aplicar, dropdown alternativos, total, popover).
5. Migrar o kit Apostila padrão de `auto_spiral` → `variant_by_sheets` com faixas pré-cadastradas (opcional).

Posso seguir nessa direção? Se sim, começo pela migration e pela engine; depois UI.