# Arte: pergunta única por orçamento

Hoje cada formulário (Impressão, CV, Etiqueta, Booklet) repete o bloco "Tem arte pronta?" a cada item adicionado. Vamos mover essa pergunta para o nível do orçamento — responde uma vez, vale para todos os itens.

## Comportamento novo

- A pergunta vive no cabeçalho do `NewQuoteFormV3`, ao lado de Cliente/Assunto (uma faixa fina logo abaixo dos campos, sempre visível).
- Os formulários de Impressão, CV, Etiqueta e Booklet **não exibem mais** o `ArtePromptBlock`.
- Cada item criado já entra "carimbado" com o `art_status` global do orçamento (sem precisar responder).
- O **custo de arte** entra **uma vez por orçamento** (e não por item):
  - Interna (Ajuste/Fácil/Moderada/Elaborada) → 1 linha "Arte — <tier>" calculada como `minutos × Valor da Hora de Trabalho`.
  - Terceirizada → 1 linha "Arte terceirizada" com o valor informado.
  - "Cliente envia pronta" ou sem resposta → nenhuma linha de arte.
- Trocar a resposta no cabeçalho **atualiza** a linha de arte (substitui/remove) e **re-carimba** o `art_status` dos itens existentes.
- A validação no Save ("responda 'Tem arte pronta?' em todos os itens") vira: bloqueia salvar se houver itens que exigem arte e a resposta global ainda estiver vazia.

## Onde fica na UI

Cabeçalho do orçamento, segunda linha (abaixo de Cliente + Assunto): um `ArtePromptBlock` compacto. No modo edição, ele já vem preenchido com a resposta carregada.

## Arquivos afetados

- `src/components/orcamentos-v3/types.ts` — adicionar `art_status?: ArtStatus | null` e `art_terceirizada_value?: number` em `V3QuoteState` + `DEFAULT_STATE`.
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` — renderizar `ArtePromptBlock` no header; reconciliar linha única de arte ao mudar resposta; ajustar validação de Save; passar `art_status` para os formulários (via prop) para stamping automático.
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — remover bloco/estado local de arte; no submit usar `state.art_status` para `stampArt`; **não** chamar mais `makeArtInternal`/`makeArtThirdParty` aqui.
- `src/components/orcamentos-v3/forms/CVForm.tsx` — mesma limpeza.
- `src/components/orcamentos-v3/shared/saveQuoteV3.ts` — persistir `art_status`/`art_terceirizada_value` no `v3_payload`.
- `src/components/orcamentos-v3/shared/loadQuoteV3.ts` — restaurar esses campos ao editar (compatível com payloads antigos, em que cada item já tem `art_status` próprio — usar o mais frequente como fallback).

## Reconciliação da linha de arte (detalhe técnico)

Quando o `art_status` global muda:
1. Remover qualquer item `third` existente com `fornecedor` em {"Arte (interna)", "Arte (terceiro)"} que **não** esteja vinculado a `bundle_id` (legado fica intocado).
2. Se nova resposta for `ready` ou `null` → não adicionar nada.
3. Se interna → adicionar 1 `makeArtInternal(status, hourRate, null)`.
4. Se terceirizada → adicionar 1 `makeArtThirdParty(value, null)` (input do valor permanece no próprio `ArtePromptBlock`).
5. Re-`stampArt` em todos os itens existentes (idempotente).

`bundle_id` fica `null` porque a arte agora é do orçamento, não de um item específico.

## Fora do escopo

- Migração de orçamentos antigos (continuam funcionando: cada item mantém seu `art_status` salvo).
- Mudar `ArtePromptBlock` visualmente — só muda onde ele é renderizado.
- Itens "Terceiros" e "Mão de obra" avulsos.
