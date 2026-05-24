# Aviso: arte é cobrada uma única vez por orçamento

Adicionar um aviso curto e visível dentro do `ArtePromptBlock` (já renderizado no cabeçalho do orçamento) deixando claro que o custo da arte é aplicado **uma única vez ao orçamento todo**, não por item.

## Onde

- `src/components/orcamentos-v3/shared/ArtePromptBlock.tsx`

## O que muda

- Adicionar uma linha curta com ícone `Info` logo abaixo do título "Tem arte pronta?", visível sempre que o bloco aparecer:
  > "O custo da arte é cobrado uma única vez no orçamento — não por item."
- Estilo: `text-[11px] text-muted-foreground` com ícone `h-3 w-3`, alinhado à esquerda. Sem caixa colorida — fica discreto mas legível.
- Quando o usuário selecionar uma das opções com custo (Ajuste/Fácil/Moderada/Elaborada/Terceirizada), trocar o aviso por uma versão reforçada em `primary` mostrando a tradução do que será somado:
  - Interna: "Vai somar **R$ X,XX** ao orçamento (Y min × valor da hora) — uma única vez."
  - Terceirizada: "Vai somar **R$ X,XX** ao orçamento — uma única vez."
  - "Cliente envia pronta" e sem resposta: mantém o aviso neutro.

Para calcular o valor exibido, o componente vai receber duas novas props opcionais:
- `hourRate?: number` — para calcular o custo das tiers internas.
- (já recebe `terceirizadaValue`)

E `NewQuoteFormV3.tsx` passa o `hourRate` que já tem disponível via `useHourRate()`.

## Fora do escopo

- Mudar a lógica de reconciliação (já feita).
- Mudar visualmente os botões/tiers.
