# Comunicação Visual: campos prontos ao abrir o orçamento

## O que muda

Hoje, ao abrir um novo orçamento, o bloco "Comunicação Visual" só aparece se houver itens. E mesmo abrindo, mostra um estado vazio com o botão "Adicionar peça de comunicação visual" — exige um clique extra antes de aparecerem largura, altura, mídia, etc.

A proposta é: o bloco já aparece desde o início, com **uma peça em branco pronta para preencher**. O colapso continua existindo (pode iniciar recolhido), mas ao abrir, os campos já estão lá.

## Comportamento proposto

1. Ao montar o formulário de novo orçamento, criar automaticamente **1 item CV vazio** (largura 0, altura 0, qtd 1, sem mídia/impressão/acabamentos selecionados) — somente se `cvMaterials.length > 0` (existe mídia cadastrada).
2. Bloco "Comunicação Visual" passa a renderizar sempre (não depende mais de `cvItems.length > 0`), desde que haja materiais cadastrados.
3. Colapso inicia **recolhido** (mantém `cvOpen = false` como hoje), apenas com o cabeçalho visível — clique abre direto nos campos da peça.
4. Remover o estado "Nenhuma peça… [Adicionar peça]" — não é mais necessário, pois sempre há ao menos 1 peça.
5. Botão **"Adicionar outra peça"** continua no rodapé do bloco para incluir peças adicionais.
6. Se o usuário remover a única peça existente, o bloco volta ao estado de "vazio com botão Adicionar" (fallback, para não travar o fluxo).
7. Subtotal e card de "Inteligência do orçamento" continuam aparecendo só quando há peça com dados preenchidos (sem regressão visual).

## Sobre "Tipo de material"

A pergunta final ("Tipo de material você considera essa a melhor opção?") está ambígua. Duas leituras possíveis:

- **(A)** "Você (Lovable) considera essa a melhor opção de UX?" → Sim, considero boa: reduz 1 clique, deixa o formulário auto-explicativo e mantém o colapso para não poluir orçamentos que não usam CV. O único risco é o usuário achar que "tem que" preencher CV mesmo quando o orçamento é só de impressão — mitigado por manter o bloco recolhido por padrão.
- **(B)** Aplicar o mesmo padrão ao campo/bloco "Tipo de material" (impressão, papéis, etc.) → posso replicar a mesma lógica nos outros blocos do formulário, se for o caso.

**Decisão pendente:** confirmar se quer apenas o ajuste em Comunicação Visual (escopo deste plano) ou replicar em outros blocos também.

## Arquivos afetados

- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — remover o gate `cvItems.length > 0 || cvMaterials.length > 0` do bloco, remover o estado vazio com botão, e inicializar `cvItems` com 1 peça em branco no mount (quando há mídias cadastradas e o formulário é novo, não edição).
