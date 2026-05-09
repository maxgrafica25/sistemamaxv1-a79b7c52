# Simplificar entrada: só "Peças desejadas"

## Mudança
No card de impressão (`PrintingItemEditor.tsx`), substituir os dois inputs (peças e folhas) por **um único input** de **Peças desejadas**. As folhas viram **somente leitura**, exibidas como informação derivada — sem campo editável.

## Como fica

```
┌─ Quantidade
│  Peças desejadas     [ 100 ]    R$ 21,00    [📐] [✕]
│  └─ Usa 3 folhas (48 un/folha · sobra 44 un)
```

- Input único, label claro: **"Peças desejadas"**.
- Abaixo, linha auxiliar pequena mostrando: `Usa N folhas` + `(X un/folha · sobra Y un)`.
- Total e botões (régua + remover) na mesma linha do input.

## Comportamento

- Usuário digita peças → sistema calcula `folhas = ceil(peças / un_por_folha)` e salva em `item.quantity` (que internamente continua representando folhas, mantendo o motor de preço intacto).
- Se ainda não há dimensões/papel definidos (sem rendimento calculável), o input mostra "Defina dimensões e papel para informar a quantidade" e fica desabilitado.
- Botão da régua 📐 (calculadora de etiquetas) continua disponível para casos avançados — ele já grava direto em folhas, então quando aplicado, recalculamos o display de peças = `folhas × un_por_folha`.
- Itens aprovados (locked): exibe peças e folhas como texto puro, sem input.

## Detalhes técnicos

- Arquivo único: `src/components/orcamentos-v2/PrintingItemEditor.tsx`.
- Remover a "Linha 2" (Quantidade folhas) com input editável criada na rodada anterior.
- Manter `item.quantity` em folhas no estado/banco — nada muda no motor de pricing nem no PDF.
- Linha auxiliar de "sobra" usa `folhas × un_por_folha − peças` (só mostra se > 0).
- O bloco "Rendimento" abaixo (que mostra `9 un/folha · Total: 6 folhas`) fica redundante após essa mudança — proponho **removê-lo** para não duplicar informação. (Confirmar abaixo.)

## Pontos a confirmar
- **Bloco "Rendimento" atual** (`Layers · Rendimento: X un/folha (orientação) · Total: Y folhas`): manter ou remover, já que a mesma info passa a viver direto sob o input?
- **Aviso "excede a folha de produção"**: mantém como está (continua útil quando dimensões > folha).

## Fora de escopo
- Lógica de preço, multiplicadores A3/SRA3 e rendimento por folha (sem mudança).
- Outros itens que não são impressão (mão de obra avulsa, materiais legados).
