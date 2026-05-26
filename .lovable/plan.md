# Fix: botões deslocam ao trocar Frente ↔ F/V (preset Tags e demais que usam PrintForm)

## Causa
No header do papel selecionado em `PrintForm.tsx` (linhas ~472–530), a linha usa `flex items-center gap-3 flex-wrap`. Ao alternar Frente/F/V:

- O texto do título muda de comprimento (`...A4 Frente` → `...A4 F/V`).
- O `pricing.tierLabel` (badge) costuma mudar de faixa quando o custo dobra, virando uma string mais longa/curta.
- O cluster da direita (toggle Frente|F/V + botão "Trocar") não tem âncora fixa, então o `flex-wrap` quebra/realinha — produzindo o "pulo" relatado.

## Mudança (apenas visual, escopo mínimo)
Arquivo único: `src/components/orcamentos-v3/forms/PrintForm.tsx`, bloco do header do catálogo (linhas ~472–530).

1. Trocar `flex-wrap` por layout estável: a linha principal não quebra; o cluster da direita fica ancorado com `ml-auto shrink-0`.
2. Garantir `shrink-0` no toggle (Frente|F/V) e no botão "Trocar" para nunca serem empurrados.
3. Reservar largura mínima previsível no slot do badge `tierLabel` (`min-w-[3.5rem] inline-flex justify-center` ou simplesmente `whitespace-nowrap`) para que a troca de faixa não realinhe o restante.
4. Manter o título com `truncate` (já existe) — a área de texto absorve qualquer variação via `flex-1 min-w-0`.
5. Em telas estreitas onde antes quebrava, permitir wrap só do bloco de texto (não do cluster de ações) usando `flex-nowrap` no container e `flex-wrap` apenas internamente, se necessário.

## Fora do escopo
- Não mexer em lógica de preço, catálogo, presets ou outros forms (BusinessCard/Certificate/Booklet).
- Não alterar comportamento de toggle nem multiplicador F/V.

## Verificação
- Abrir preset Tags → selecionar papel → clicar várias vezes em Frente/F/V e confirmar que toggle e botão "Trocar" permanecem fixos na mesma posição.
- Conferir em viewport ~1336px e em ~600px (mobile) que o cluster da direita continua estável.
