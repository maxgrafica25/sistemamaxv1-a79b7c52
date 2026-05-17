## Problema

Hoje há duas fontes de verdade para insumos físicos do CV (bastão, ponteiras, cordinha, ilhós, laminação etc.):

1. **`supplies`** (Matérias-primas) — custo real de compra (`valor_unitario`, `unidade`, `fornecedor`) e histórico de preços.
2. **`cv_calc_acabamentos`** — guarda `custo_*` e `lucro_*` **já pré-calculados e congelados** (ex: bastão 105cm = R$17 custo / R$14 lucro por unidade).

Quando o preço do bastão sobe, você precisa atualizar nos dois lugares — e o "lucro" do CV nem reflete o markup global (impostos, cartão, comissão, margem) usado no Orçamentos v2.

## Conceito da solução

**Acabamento de CV vira uma "receita" que aponta para um ou mais suprimentos**, e o sistema calcula sozinho o preço de venda usando o mesmo motor de markup global do Orçamentos v2.

```text
cv_calc_acabamentos                supplies (matérias-primas)
┌─────────────────────────┐        ┌──────────────────────────┐
│ Banner bastão 105cm     │        │ Bastão 19mm 105cm  R$3,30│
│  receita:               │───────▶│ Ponteira plástica  R$0,80│
│   • Bastão 105cm × 2 un │        │ Cordinha branca m  R$0,40│
│   • Ponteira      × 4 un│        └──────────────────────────┘
│   • Cordinha      × 1,2m│
│  + custo extra fixo R$0 │        global_settings
│  + mão-de-obra/m² R$4   │        ┌──────────────────────────┐
│                         │        │ tax 10% + cartão 7%      │
│  margem: [global ▼]     │───────▶│ comissão 7% + margem 33% │
└─────────────────────────┘        └──────────────────────────┘

Custo unidade = Σ(supply.valor_unitario × consumo) + mão-de-obra
Preço venda  = Custo / (1 − (impostos + taxas + margem)/100)  ↑ arredonda R$0,10
```

### O que muda no schema (aditivo, **não destrutivo**)

Em `cv_calc_acabamentos`, adicionar **opcionais**:

- `pricing_mode` — `'manual'` (default, mantém comportamento atual) | `'recipe'` (calculado por supplies + markup global)
- `markup_override_pct` — null = usa `global_settings`; número = sobrescreve margem só desse acabamento
- `extra_cost_fixo`, `extra_cost_mt2`, `extra_cost_perimetro`, `extra_cost_unidade` — mão-de-obra/insumos não cadastrados (ex: tempo de costura da bainha)

Nova tabela `cv_calc_acabamento_recipe_items`:

```text
id, acabamento_id (FK), supply_id (FK supplies),
consumo_qty (numeric),
consumo_tipo: 'por_peca' | 'por_perimetro_m' | 'por_mt2' | 'por_largura_m' | 'por_altura_m'
```

Exemplo da receita do **Banner bastão 105cm**:

```text
Bastão 19mm 105cm  → 2 un  por_peca         (topo + base)
Ponteira plástica  → 4 un  por_peca         (4 cantos)
Cordinha branca    → 1.2 m por_largura_m    (largura + folga)
```

### O que muda no engine (`src/lib/cv-calc/engine.ts`)

`precificarAcabamento()` ganha uma rota nova quando `pricing_mode === 'recipe'`:

```text
1. custo_un_da_peça = Σ supply.valor_unitario × consumo_unidades(peça)
   + extra_cost_fixo (rateado) + extra_cost_mt2×área + extra_cost_perim×perím + extra_cost_unidade×qtd
2. preço_un = custo_un / (1 − (tax + card + collection + margin)/100)
3. arredonda para cima em R$0,10 (regra global já existente)
```

Se `pricing_mode === 'manual'`, **nada muda** — usa `custo_*`/`lucro_*` exatamente como hoje. Garantia de zero regressão.

### O que muda na UI

**Aba Acabamentos (`AcabamentosTab`)** — cada acabamento tem um toggle:

- ⚪ Manual (custo + lucro digitados — como hoje)
- ⚫ Receita (lista de suprimentos × consumo, calcula sozinho)

Quando "Receita" está ligado, aparece um sub-painel com:

- Picker de suprimento (reusa `SupplierCombobox`/busca já existente)
- Quantidade + tipo de consumo (por peça / perímetro m / m² / largura m / altura m)
- Linha de "custos extras" (mão-de-obra etc.)
- Preview ao vivo: `Custo R$X,XX  →  Venda R$Y,YY (margem global 33%)`

**Aba Matérias-primas** — nada muda. Só passa a aparecer como fonte para receitas.

### Migração dos dados existentes

- Todos os 14 acabamentos atuais ficam com `pricing_mode = 'manual'` (default). Cálculos atuais **não mudam**.
- Você migra um a um quando quiser: cria os suprimentos faltantes (ponteira, cordinha) em Matérias-primas, abre o acabamento e troca para "Receita".
- Testes existentes do engine continuam passando (todos usam modo manual).

## Por que essa é a abordagem certa

- **Não estraga nada**: modo manual continua sendo o default e o caminho de cálculo é literalmente o código atual.
- **Uma fonte de verdade por insumo**: bastão tem preço em **um** lugar (supplies). Subiu o custo → atualiza ali → todos os acabamentos que usam recalculam sozinhos.
- **Markup coerente com o resto do ERP**: impostos, cartão, comissão e margem vêm de `global_settings` (mesma fórmula do Orçamentos v2 — memory `mem://features/pricing`).
- **Histórico de preço grátis**: como o custo passa por `supplies`, o `supply_purchase_history` já existente registra a evolução do custo do bastão automaticamente.
- **Receita é flexível**: bastão 150cm aproveita a mesma ponteira e cordinha do 105cm — você define a receita, não cola preço.

## Perguntas antes de eu implementar

1. **Mão-de-obra** (ex: tempo do refile, costura da bainha) entra como **custo extra fixo no próprio acabamento** (rota mais simples, proposta acima) ou você quer um cadastro separado de "tarefas de produção" com custo/hora?
2. Para acabamentos que **hoje têm `lucro_*` diferente de uma margem percentual** (ex: emenda R$70 custo + R$25 lucro fixo = ~26%), no modo receita você prefere: (a) sempre usar o markup global, ou (b) deixar o `markup_override_pct` para casos pontuais?
3. Quer que eu já crie os suprimentos faltantes (ponteira, cordinha) e migre o **Banner bastão 105cm** como prova de conceito, ou só entrega a infraestrutura e você migra manualmente depois?
