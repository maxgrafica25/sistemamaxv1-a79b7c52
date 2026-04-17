
## Mudança

Atribuir uma **cor distinta por fornecedor** nos cards da aba "Oportunidades" para facilitar identificação visual.

## Como

Em `src/pages/Monitoramento.tsx`:

1. Criar um helper `getSupplierColor(supplierName)` que retorna classes Tailwind (bg + border + text) baseadas em hash determinístico do nome — assim o mesmo fornecedor sempre tem a mesma cor.
2. Paleta fixa de ~8 cores distintas usando tokens semânticos do design system (variações de `primary`, `accent`, `secondary`, etc., com opacidades). Exemplos:
   - ANS → azul
   - Atual Card → roxo
   - Futura → verde
   - Imprima Rápido → laranja
3. Aplicar a cor no **badge do nome do fornecedor** dentro de cada linha do card de oportunidade, e numa **borda lateral colorida** (4px à esquerda) para escaneabilidade rápida.
4. Manter o badge "Mais barato" (verde) inalterado — ele tem semântica própria.

## Arquivos

- `src/pages/Monitoramento.tsx` — único arquivo afetado (helper + JSX da aba oportunidades)

## Limitação

Hash determinístico pode colidir se houver mais de 8 fornecedores diferentes (cores se repetem). Para os 4 fornecedores atuais (ANS, Futura, Atual Card, Imprima Rápido) não há conflito.
