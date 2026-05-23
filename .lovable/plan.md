# Permitir trocar o suprimento sugerido em itens do Kit Encadernação

## Contexto
No `BookletKitPanel`, as linhas de **suprimento** (Capa frontal, Contracapa, Espiral) hoje são fixas no item resolvido por regex (ex.: Espiral 7mm). Hoje só dá pra: marcar/desmarcar, ou (nas capas) trocar por impressão "Personalizada". Não há como trocar o **suprimento sugerido** por outro do mesmo tipo (ex.: Espiral 7mm → 9mm).

## Mudança proposta (apenas `BookletKitPanel.tsx`)

1. **Novo estado** `overrides: Partial<Record<KitRowKind, SupplyOption>>` (apenas para `capa`, `contracapa`, `espiral`).

2. Em `renderRow`, nas linhas de **suprimento em modo padrão** (não Personalizada), adicionar um botão pequeno **"Trocar"** ao lado do preço. Ao clicar, expande inline um bloco com `<SupplySearch>` filtrado pela categoria/tipo da linha.

3. Quando há override:
   - A linha exibe o **nome/preço do suprimento escolhido** (com `Number(s.valor_unitario) × units`), com badge sutil "trocado".
   - Botão **"Restaurar sugestão"** (X) ao lado para limpar o override.

4. Em `apply()`, para cada `r` de tipo suprimento, se houver `overrides[r.key]`, em vez de chamar `r.build()`, montar um `V3SupplyItem` a partir do override (mesmo padrão dos `extraSlots`).

5. Para capas, o override só é válido em modo `standard`. Trocar para `Personalizada` continua limpando o override.

## Fora do escopo
- Não mexer em `bookletKit.ts` (mantém regex/sugestão).
- Não tocar nos forms vizinhos nem nas linhas de mão-de-obra (Furação/Encadernação).
- Sem mudanças de persistência ou de cálculo de preço.
