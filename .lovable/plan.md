## Problema

No diálogo "Novo Papel" (Matérias-Primas), quando você marca **"Comprado já cortado no formato final"** (ex.: Sulfite A4), o restante do formulário continua exibindo rótulos `(66×96)` hard-coded:

- "Qtd. Folhas (66×96) *"
- "Frete por folha (66×96)"
- "Preço por folha (66×96)" + preview "Preço A4 (÷9)" / "Preço A3+ (÷4)"

Para uma resma de Sulfite A4, esses rótulos não fazem sentido — a folha **já é** A4, e o preview de divisão por 9/4 está conceitualmente errado (1 folha = 1 peça).

## Solução (somente UI, sem mudanças de motor/banco)

Tornar os rótulos e o preview **reativos a `paperIsCutSize`** no diálogo de cadastro/edição de papel em `src/pages/MateriasPrimas.tsx`.

### Mudanças

1. **Reordenar** o bloco "Comprado já cortado" para aparecer **antes** ou imediatamente acima dos campos Qtd./Preço, deixando claro que ele muda o significado dos campos abaixo. (Já está acima — manter.)

2. **Rótulo de quantidade** (linha 1069):
   - Se `paperIsCutSize`: `"Qtd. Folhas na resma *"` + helper "Ex.: 500 folhas em uma resma de Sulfite A4"
   - Senão: manter `"Qtd. Folhas (66×96) *"`

3. **Rótulos de frete** (linhas 1107):
   - Se `paperIsCutSize`: `"Frete por folha"` (sem "(66×96)")
   - Senão: manter como está

4. **Bloco de preview** (linhas 1115-1130) — quando `paperIsCutSize`:
   - Mostrar apenas **uma linha**: `"Custo por folha"` = `pack_price / sheet_qty + frete`
   - **Esconder** as linhas de divisão "÷9" e "÷4" (não se aplicam — folha já é a peça final)
   - Quando não marcado: manter o preview atual (preço folha 66×96 + ÷9 A4 + ÷4 A3/SRA3)

5. **Texto do bloco "cut size"** (linhas 1026-1030): pequeno ajuste — explicitar que o campo "Qtd. Folhas" abaixo passa a representar a quantidade de folhas da resma já cortada.

## Fora de escopo

- Alterar a tabela/listagem (colunas "66×96" continuam fazendo sentido para papéis de folhão)
- Mudar lógica de cálculo de custo (`paper_cost_per_sheet` continua sendo `pack/qty + frete`; o motor já trata `is_cut_size` corretamente via `resolvePaperSheet`)
- Mudar o cadastro de Suprimentos

## Resultado esperado

Ao marcar "Comprado já cortado" para um Sulfite A4:
- Campo passa a se chamar "Qtd. Folhas na resma" (sem "66×96")
- Preview mostra apenas "Custo por folha: R$ 0,4300" — sem divisões artificiais
- Usuário entende que está informando 500 folhas A4, e o sistema usará 1:1.
