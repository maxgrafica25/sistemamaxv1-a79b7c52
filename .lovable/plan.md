# Cartão de Visita: unificar built-in e favorito salvo

## Problema
Hoje aparecem **dois chips "Cartão de Visita"** na barra de Impressão + Acabamentos:
- O **built-in** (ícone CreditCard, contorno) → abre `BusinessCardForm` com sugestões do Kit de Produto.
- O **favorito salvo** pelo usuário com o mesmo nome → cai no `PrintForm` genérico, sem kit, sem sugestões de acabamento.

O usuário clica no favorito (que aparece destacado/colorido) esperando o formulário rico — e não vê sugestão nenhuma.

## Solução (decidida)
Tratar "Cartão de Visita" como **um único caminho**, independente de quem clicou:

1. **Detecção por nome** — helper `isBusinessCardName(nome)` que normaliza (lowercase, sem acento) e casa qualquer preset cujo nome contenha "cartao de visita" (ou tokens equivalentes "cartao visita").

2. **Esconder o built-in quando há colisão** — em `PrintAndProductForm.tsx`, se algum preset do usuário casar `isBusinessCardName`, omitir o chip built-in (`__builtin_business_card__`). Não há mais duplicação visual.

3. **Roteamento por tipo** — quando o preset selecionado casa `isBusinessCardName`, renderizar `BusinessCardForm` no lugar do `PrintForm`/`BookletForm`/`LabelEmbeddedForm`. Assim o favorito salvo passa a oferecer a mesma experiência do built-in (Kit de Produto + sugestões de acabamento fixos/opcionais).

4. **Quando não há colisão** — o built-in continua aparecendo como antes.

## Arquivo
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
  - Adicionar `isBusinessCardName` (helper local).
  - Calcular `hasUserBusinessCardPreset` via `useMemo` sobre `presets`.
  - Renderizar o chip built-in apenas quando `!hasUserBusinessCardPreset`.
  - Calcular `treatAsBusinessCard = isBusinessCard || (selectedPreset && isBusinessCardName(selectedPreset.nome))`.
  - Trocar as condições do bloco "Sub-formulário" para usar `treatAsBusinessCard` no lugar de `isBusinessCard`.

## Fora de escopo
- Não mexer em tabela/migrations — a heurística por nome resolve o caso reportado sem precisar consultar o vínculo N:N `product_kits ↔ quote_presets`.
- Não tocar nos outros tipos (Apostila, Etiqueta etc.).
