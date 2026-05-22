# Fixar botão "Adicionar ao orçamento" no rodapé do workspace

## Problema

Depois que o painel de faixas adicionais passou a ser inline, o formulário (Impressão / CV / Etiqueta / Terceiros / Suprimento / Apostila) ficou mais alto. O botão de ação principal — "Adicionar ao orçamento" — está no fim de cada form, então só aparece quando o usuário rola até o final. Como a área de scroll do workspace tem o mesmo `bg-background` do form, o usuário percebe o botão como "escondido atrás de um retângulo branco no rodapé".

## Solução

Em vez de fixar o botão em cada um dos 6 formulários (Print, CV, Label, Third, Supply, Booklet — e o `PrintAndProductForm` wrapper), criar uma **barra de ação sticky no rodapé do workspace** dentro de `NewQuoteFormV3.tsx`. Essa barra mostra:

- O total a adicionar (qtd × preço unitário + extras) — vindo do próprio form via callback
- O botão "Adicionar ao orçamento" (ou "Adicionar + N faixas" quando há extras)

Como hoje cada form possui seu próprio estado e seu próprio botão (com lógica diferente para tiers, kits, presets), a solução menos invasiva é:

### Abordagem escolhida — sticky dentro do scroll do workspace

Em `NewQuoteFormV3.tsx` linha 190, mudar o workspace para um wrapper flex que coloca o scroll na área de cima e mantém uma faixa visual fixa no fim. Mas como o botão vive dentro de cada form filho, o caminho mais simples é **manter o botão onde está e garantir que ele fique sempre visível** com:

1. **Adicionar `position: sticky; bottom: 0`** ao container final `<div className="flex items-center justify-end pt-2">` de cada um dos 6 formulários, com fundo `bg-background` + borda superior sutil + `py-3 -mx-4 px-4` (ou `-mx-6 px-6` no breakpoint lg) para ocupar a largura cheia e dar sensação de "barra de ação".

2. **Remover o `pb-24 lg:pb-5`** do workspace e trocar por `pb-5` simples — o sticky cuida do gap.

### Arquivos afetados

- `src/components/orcamentos-v3/forms/PrintForm.tsx` — wrapper do botão final
- `src/components/orcamentos-v3/forms/CVForm.tsx`
- `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx`
- `src/components/orcamentos-v3/forms/ThirdPartyForm.tsx`
- `src/components/orcamentos-v3/forms/SupplyForm.tsx`
- `src/components/orcamentos-v3/forms/BookletForm.tsx`

Cada um tem hoje algo como:
```tsx
<div className="flex items-center justify-end pt-2">
  <Button ...>Adicionar ao orçamento</Button>
</div>
```

Vira:
```tsx
<div className="sticky bottom-0 -mx-4 lg:-mx-6 px-4 lg:px-6 py-3 mt-2 bg-background/95 backdrop-blur border-t border-border flex items-center justify-between gap-3">
  {/* preview de total à esquerda quando relevante */}
  <Button ...>Adicionar ao orçamento</Button>
</div>
```

(Onde o form já mostra "Total: R$ X" antes do botão, mover esse texto para dentro da barra à esquerda.)

## Validação

- `/orcamentos-v3/novo` em qualquer aba (Impressão, CV, Terceirizados) — preencher campos suficientes para a forma crescer e adicionar faixas extras. O botão "Adicionar ao orçamento" permanece visível na borda inferior do workspace independente da rolagem.
- No mobile (lg:hidden), o `MobileCart` continua sobrepondo a barra — o `pb-24` no workspace mobile garante espaço.
