

# Pré-calcular preço de venda na Camada 3 do assistente

## Problema

A Edge Function envia ao Gemini os custos crus (`paper_cost + printing_cost`) e os percentuais de markup separados, deixando o cálculo para o modelo — que erra (informa custo como se fosse PV, ou aplica fórmula errada).

## Solução

Replicar a fórmula exata da página **Preço de Impressão** dentro da Edge Function e enviar ao Gemini apenas **preços de venda já calculados por faixa**, prontos para serem citados.

## Fórmula (igual à de `src/pages/PrecoImpressao.tsx`)

```
sizeMult  = (size começa com A3/SRA3/A2/A1/A0) ? 2 : 1
sideMult  = (side === "F/V") ? 2 : 1
printCost = round(printing_cost × sizeMult × sideMult × 10) / 10
baseCost  = paper_cost + printCost
soma      = (fixed_cost_pct + variable_cost_pct + margin_pct) / 100
PV        = round((baseCost / (1 - soma)) × 10) / 10     // R$ 0,10
```

Observação importante confirmada no código: os percentuais de `global_settings` (invoice, collection, waste, tax, credit_card) **não entram** nessa fórmula — a página os recebe (`_globals`) mas não usa. As faixas já contemplam tudo via `fixed_cost_pct + variable_cost_pct + margin_pct`. Vou manter exatamente esse comportamento para bater com a tela.

## Seleção da faixa (também igual à página)

Para cada item, usar:
- `item.markup_group_id` se preenchido → buscar tiers com mesmo `markup_group_id`
- caso contrário → buscar tiers da `printer_category_id` com `markup_group_id IS NULL` (ou todos da categoria, ordenados por `sort_order`)

## Mudanças

**Arquivo único: `supabase/functions/assistente-virtual/index.ts`**

### 1. Camada 3 — seção "PREÇOS DE IMPRESSÃO"

Substituir as linhas atuais que mostram custo (`papel R$ X + impressão R$ Y = custo R$ Z`) por linhas com **PV pronto por faixa**:

```
- Couchê 210 A4 F (color) [Categoria X]:
    TP1 (1-20 un) → R$ 2,45/un
    TP2 (21-50 un) → R$ 2,10/un
    TP3 (51-100 un) → R$ 1,90/un
    TP4 (101+ un)  → R$ 1,75/un
```

Para cada item ativo de `printing_price_items`, gerar uma linha com todas as faixas aplicáveis e PV calculado. Nada de paper_cost/printing_cost crus na saída ao modelo.

### 2. Remover seções obsoletas

- Remover o bloco "Faixas: TP1 (...; margem X%, fixo Y%, variável Z%)" — não serve mais ao modelo.
- Remover "CONFIGURAÇÕES GLOBAIS DE PREÇO" (não entra na fórmula; deixar fora evita o modelo tentar aplicá-las).

### 3. Reescrever a "REGRA CRÍTICA — PREÇO DE VENDA" na camada1

Trocar todo o bloco de 7 passos por uma instrução simples:

> Os preços de venda já estão calculados na seção "PREÇOS DE IMPRESSÃO" por item e por faixa de quantidade. Você NUNCA deve calcular markup, custo, fórmula ou aplicar percentuais — apenas **localizar o item exato** (paper_type + grammage + size + side + equipment_mode) e a **faixa cuja quantidade pedida cai entre min e max**, e responder com o PV listado. Se o item ou faixa não existir nos dados, responda exatamente: *"Não consegui localizar essa informação no sistema."* e diga o que faltou. Se a quantidade foi informada, multiplique PV × quantidade para o total.

### 4. Manter inalterado

- Autenticação JWT, validação Zod, CORS, modelo Gemini, camada 2 (base de conhecimento), seções de Equipamentos/Consumíveis/Papéis da camada 3.

## Validação após implementação

1. *"Quanto custa Couchê 210 A4 F color, 5 unidades?"* → Júlia localiza o item, identifica TP1, devolve PV unitário e total = exatamente o valor mostrado na tela Preço de Impressão.
2. *"E para 80 unidades?"* → mesma item, faixa TP3, PV correto.
3. *"Quanto custa um folder?"* → pede paper_type/size/side/equipment_mode/quantidade.
4. *"Couchê inexistente"* → "Não consegui localizar essa informação no sistema."

## Risco

Baixo. Mudança contida em um único arquivo, fórmula copiada literalmente da página existente, sem alteração de banco/UI/auth.

