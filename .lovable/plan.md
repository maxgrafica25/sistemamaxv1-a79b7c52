

# Validar PVs em logs e simplificar prompt da Júlia

## Diagnóstico

Calculei manualmente os PVs com a fórmula atual da Edge Function usando os dados reais do banco para Couché 210 A4 F Xerox C70 Color:

- `paper_cost` = R$ 0,20 (banco)
- `printing_cost` é recalculado via consumíveis (item tem `equipment_id`, categoria color → cobertura 20%) → custo base ≈ R$ 0,189 × 4 = R$ 0,7566 → `roundUp5` = **R$ 0,80**
- `baseCost` = 0,20 + 0,80 = **R$ 1,00**
- Tiers do grupo `2b34d124...` (default da categoria, casa com `markup_group_id` do item): TP1 m=20, TP2 m=15, TP3 m=12, TP4 m=10. Fixo 33 + Variável 20 sempre.
- PVs: **R$ 3,70 | R$ 3,10 | R$ 2,90 | R$ 2,70** ✓

**Conclusão:** A fórmula da Edge Function (`calcPV`, `getEquipmentCostPerPage`, `getEffectivePrintingCost`, `tiersForItem`) já está matematicamente correta e produz exatamente os valores esperados. O problema **não é cálculo** — é que o Gemini está escolhendo linhas erradas ou inventando, apesar de receber os dados certos.

## O que mudar

Arquivo único: `supabase/functions/assistente-virtual/index.ts`. Sem alterar autenticação, Zod, CORS, camada 2, equipamentos/papéis.

### 1. Log de validação no boot (temporário, removível depois)

Após montar `precoLines`, varrer os itens calculados e logar via `console.log` apenas as linhas cujo label contém "Couche" + "210" + "A4" + "F" + "color". Isso aparecerá em `supabase--edge_function_logs` na primeira invocação após deploy e prova que os PVs gerados batem com 3,70/3,10/2,90/2,70 antes de chegarem ao Gemini.

### 2. Reescrever a Camada 1 (prompt) — versão mínima e proibitiva

Substituir todo o bloco "REGRA CRÍTICA — PREÇO DE VENDA" por exatamente:

> **PREÇOS DE VENDA**  
> Os preços estão pré-calculados na seção PREÇOS DE IMPRESSÃO por item e por faixa.  
> Para responder:  
> 1. Localize o item EXATO casando paper_type + grammage + size + side + equipment_mode (e equipamento, se houver mais de um).  
> 2. Identifique a faixa cujo intervalo cobre a quantidade pedida.  
> 3. Cite o PV listado. Se houver quantidade, multiplique PV × quantidade.  
>  
> Você **NUNCA** calcula, estima, aproxima nem aplica percentuais. Apenas localiza e cita.  
> Se o item ou a faixa não existir, responda: *"Não encontrei esse item na tabela de preços."*

Manter o bloco de "DESAMBIGUAÇÃO POR EQUIPAMENTO" (continua útil quando há mais de um equipamento com mesmo papel).

### 3. Limpar ruído numérico do prompt

- Remover de `eqLines` e dos consumíveis tudo que mostra preço/rendimento por consumível (esses números levam o modelo a tentar refazer o cálculo). Manter só `nome do equipamento`, `tipo`, `contador atual` e `impressões desde última troca`.
- Não enviar `paper_cost`/`printing_cost` em lugar nenhum (já não enviamos no PREÇOS DE IMPRESSÃO; confirmar que não vaza por outra seção).

### 4. Reforçar o rótulo de cada linha de preço

Trocar o formato atual `Couche 210 A4 F (color) [Xerox C70]:` por algo mais inequívoco com separadores fortes, para reduzir colisão de matching no modelo:

```
- [Xerox C70 | color] Couche 210 | A4 | F:
    TP1 (1–10 un) → R$ 3,70/un
    TP2 (11–50 un) → R$ 3,10/un
    TP3 (51–100 un) → R$ 2,90/un
    TP4 (101+ un)  → R$ 2,70/un
```

Cada faixa em uma linha separada (em vez de tudo numa linha com `|`) — facilita o LLM grudar no token certo.

## Validação após deploy

1. Invocar a Júlia uma vez (qualquer pergunta) para popular logs.
2. Em `supabase--edge_function_logs` filtrar por "Couche 210" — deve aparecer linha logada com os 4 valores 3,70/3,10/2,90/2,70.
3. Perguntar à Júlia: *"Quanto custa Couché 210 A4 F color Xerox C70, 5 unidades?"* → resposta deve citar **R$ 3,70/un** e total **R$ 18,50**.
4. *"E para 80 unidades?"* → **R$ 2,90/un**, total **R$ 232,00** (faixa TP3, 51–100).
5. *"Couché 210 A4 F color, 1500 un"* → **R$ 2,70/un**, total **R$ 4.050,00** (TP4).
6. *"Couché 999 A4"* (inexistente) → "Não encontrei esse item na tabela de preços."

## Risco

Baixo. Cálculo já está certo (validado contra o banco). Mudanças são: (a) log temporário, (b) prompt mais curto e proibitivo, (c) formatação das linhas para reduzir ambiguidade no LLM. Sem alterar fórmula, sem alterar banco, sem alterar UI.

