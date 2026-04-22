

# Júlia calcula preço de venda (sem inventar)

## Problema

Hoje a Júlia mostra apenas o **custo** e manda o usuário olhar a tela "Preço de Impressão". O usuário quer que ela informe **o preço de venda final** — e, se não conseguir calcular com certeza, dizer claramente "não localizei" em vez de chutar.

## Insight

A fórmula do preço de venda é determinística e usa só dados que a Júlia já recebe no prompt:

```
PV = custo / (1 - (C.Fixo + C.Variável + Margem) / 100)
```

Onde `custo = paper_cost + printing_cost` (do `printing_price_items`) e os três percentuais vêm da `markup_tier` correta (faixa de quantidade + categoria + grupo de markup). Não há "chute" — é a mesma conta da tela Preço de Impressão.

Arredondamento: para cima ao próximo R$ 0,05 (regra já oficial do sistema).

## Mudança

**Arquivo único: `supabase/functions/assistente-virtual/index.ts`**

Reescrever a "REGRA CRÍTICA — PREÇO DE VENDA" na `camada1` para:

1. **Instruir Júlia a calcular** o preço de venda usando a fórmula acima, com os dados das seções "PREÇOS DE IMPRESSÃO" e "Faixas".
2. **Passos obrigatórios** que ela deve seguir mentalmente antes de responder:
   - Identificar o item exato (paper_type + grammage + size + side + equipment_mode).
   - Identificar a categoria do item e a faixa (TP) pela quantidade pedida.
   - Somar `paper_cost + printing_cost` = custo unitário.
   - Aplicar `PV = custo / (1 - (fixed_cost_pct + variable_cost_pct + margin_pct) / 100)`.
   - Arredondar PV para cima ao próximo R$ 0,05.
   - Multiplicar pela quantidade para o total, se solicitado.
3. **Regra de "não inventar"** explícita: se faltar QUALQUER um destes — item exato nos dados, faixa para a quantidade, ou os 3 percentuais da faixa — responder textualmente: *"Não consegui localizar essa informação no sistema."* e listar o que falta (ex.: "não encontrei item Couche 210 A4 F color" ou "não há faixa cadastrada para 5 unidades nessa categoria").
4. **Proibições reforçadas**: nunca usar margem padrão global se a faixa não tiver os 3 percentuais; nunca aproximar; nunca dar "estimativa".

## Fora de escopo

- Não mudar a Edge Function em estrutura, autenticação, validação ou camadas 2/3.
- Não mudar UI, frontend, banco ou migration.
- Não mudar o modelo (continua `google/gemini-2.5-flash`).

## Risco

Baixo. Mudança apenas de prompt. Comportamento esperado: para "Couche 210 A4 F color, 5 un", Júlia identifica TP1 (1–10 un), aplica os percentuais da faixa sobre o custo cadastrado e devolve preço unitário + total. Se a faixa TP1 da categoria não estiver cadastrada, ela diz "não localizei" em vez de chutar.

## Validação após implementação

1. *"Quanto custa Couche 210 A4 F color, 5 unidades?"* → deve devolver preço de venda unitário e total, batendo com a tela Preço de Impressão.
2. *"Quanto custa um folder?"* (sem especificar) → deve pedir esclarecimento (papel, tamanho, lado, quantidade).
3. *"Quanto custa um papel que não existe?"* → deve responder "Não consegui localizar essa informação no sistema."

