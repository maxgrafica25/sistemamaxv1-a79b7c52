# Eliminar espaço em branco abaixo da barra "Adicionar ao orçamento"

## Causa raiz
A barra `sticky bottom-0` vive **dentro** do container de scroll do workspace (`NewQuoteFormV3.tsx`, div com `overflow-y-auto flex-1`). Quando:
- o conteúdo do form é mais curto que o container → a barra cola na parte inferior do viewport, mas o container tem altura `flex-1` (ocupa toda altura disponível), gerando área branca abaixo da barra quando se rola até o fim;
- o usuário rola com o mouse sobre a sidebar do carrinho (que tem scroll próprio só na lista de itens) → o evento de scroll borbulha para o workspace, deslocando-o e expondo a área vazia.

A barra sticky em si não é o problema — é o fato de ela estar **acoplada ao scroll do form** dentro de um container que sempre tem altura cheia.

## Solução proposta

**Mover a barra de ação para fora do form**, transformando-a em **rodapé fixo da coluna do workspace** (irmã do scroll, não filha). Assim:
- O container de scroll só ocupa o espaço acima do rodapé;
- A barra fica sempre visível, sem `sticky` interno;
- Não há "espaço em branco abaixo" porque o scroll termina exatamente onde o rodapé começa;
- Eventos de scroll que borbulhem da sidebar não conseguem expor área vazia.

### Implementação

1. **`NewQuoteFormV3.tsx`** — Transformar a coluna do workspace em flex coluna com header (tabs/descrição), scroll central (`flex-1 min-h-0 overflow-y-auto`) e rodapé fixo (`shrink-0 border-t bg-background`).
2. **Cada form V3** (`BusinessCardForm`, `BookletForm`, `PrintForm`, `CVForm`, `ThirdPartyForm`, `LaborForm`, `SupplyForm`, `LabelEmbeddedForm`):
   - Remover a `<div className="sticky bottom-0 …">` interna;
   - Expor o estado/handler "submit + canAdd + label" via render prop ou prop `footerSlot`/callback;
   - Manter toda a lógica de cálculo (`buildItem`, `submit`, `pulse`, `extraTiers`) intacta.
3. Para evitar refator pesado de 8 forms, usar abordagem mais simples: **manter o botão dentro do form mas remover `sticky` e os `-mx/-mb` negativos**. O botão vira inline ao fim do conteúdo. A barra de ação **fixa do workspace** fica vazia/escondida — alternativa é deixar o botão dentro do form e apenas eliminar a área branca abaixo encolhendo o scroll container ao tamanho do conteúdo (`overflow-y-auto` continua, mas `flex-1` é substituído por `min-h-0` + altura calculada).

### Abordagem escolhida (mínima, sem refator dos 8 forms)

Manter a sticky bar **mas garantir que não exista espaço vazio abaixo dela**:

a. Em `NewQuoteFormV3.tsx`, envolver o conteúdo do scroll workspace em um wrapper `min-h-full flex flex-col` para que o form **estique** até o fim do container. A sticky bar interna do form já tem `mt-6` que vira `mt-auto` num flex column quando o filho é único — assim a barra encosta no fim natural do container, eliminando a faixa branca.

b. Adicionar `overscroll-contain` na sidebar do carrinho (`<aside>` e na div interna) para que o scroll com mouse sobre o carrinho **não borbulhe** para o workspace.

c. Ajustar o wrapper imediato do form (`<div className="mt-6 max-w-3xl">`) para `mt-6 max-w-3xl flex-1 flex flex-col` — assim o form ocupa toda altura disponível e a sticky bar, sendo o último filho com `mt-6` (que viraremos `mt-auto` via classe condicional), fica grudada no fim.

## Arquivos afetados
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (2 trechos: wrapper do scroll + `<aside>` do cart com `overscroll-contain`)
- Os 8 forms V3 já editados: trocar `mt-6` por `mt-auto` na barra sticky.

## Fora do escopo
- Nenhuma mudança em lógica de cálculo, kits, faixas ou persistência.
- Sem refator estrutural dos forms.
