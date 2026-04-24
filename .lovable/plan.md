## Objetivo

Na Xerox C70, remover o consumível "Toners Colors" (R$ 2.100 / 35.000 pág) e cadastrar 3 toners separados:

- Toner Ciano — R$ 860,00 — 35.000 pág (5%)
- Toner Magenta — R$ 860,00 — 35.000 pág (5%)
- Toner Amarelo — R$ 860,00 — 35.000 pág (5%)

Todos no modo **color_only** (igual ao "Toners Colors" atual), para continuarem entrando só no custo de páginas coloridas.

## O que muda

- **1 deleção** na tabela `equipment_consumables` (Toners Colors da C70)
- **3 inserções** na mesma tabela, vinculadas ao equipamento Xerox C70
- Sort_order ajustado para os 3 toners aparecerem juntos no topo da lista colorida (posições 1, 2, 3), empurrando os demais para baixo

## Resultado esperado na tela

A aba "Consumíveis — Xerox C70" passa a mostrar:

```text
Toner Preto         R$    700,00   35.000   R$ 0,0200
Toner Ciano         R$    860,00   35.000   R$ 0,0246
Toner Magenta       R$    860,00   35.000   R$ 0,0246
Toner Amarelo       R$    860,00   35.000   R$ 0,0246
Revelador Preto     R$  2.125,00  600.000   R$ 0,0035
Relevadores Color   R$  6.375,00  600.000   R$ 0,0106
... (demais inalterados)
```

**Custo total color por página** (5% cobertura) sobe ~R$ 0,018 vs. hoje, refletindo o custo real (3 × R$ 860 = R$ 2.580 em vez de R$ 2.100).

## Observação sobre cobertura 20%

Você mencionou que em 20% o rendimento real é 8.000 páginas. Conforme combinado, **vamos cadastrar com 35.000 (5%)** para manter consistência com o resto do sistema. Se mais adiante quiser ver os dois custos lado a lado (5% e 20%), posso evoluir o módulo para suportar rendimento duplo.

## Detalhes técnicos

- Tabela: `public.equipment_consumables`
- `equipment_id`: Xerox C70 (já identificado)
- `mode`: `color_only`
- Operação feita via tool de inserção de dados (1 DELETE + 3 INSERT)
- Nenhuma alteração de schema, código ou UI necessária

**Aprova?**