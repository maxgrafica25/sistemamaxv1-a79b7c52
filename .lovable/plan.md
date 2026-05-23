## Kit do Booklet — refletir o item trocado no nome principal

Hoje, ao usar **Trocar** no kit (ex.: troca de espiral), a linha continua mostrando em negrito o nome do item sugerido pelo kit (ex.: "Espiral 7mm") e, ao lado, o nome do produto novo + badge "trocado". Visualmente parece que o orçamento ainda contém o espiral antigo.

### Mudança em `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` (função `renderRow`)

- Quando existir `override` para a linha:
  - Substituir o `<span className="font-medium">{r.label}</span>` (linha 319) pelo `override.produto`, mantendo `font-medium` e `truncate`.
  - Remover o bloco que repetia `override.produto` no meio da linha (linhas 324-330) — manter apenas o badge `TROCADO` (compacto, ao lado do nome).
  - Quando **não** houver override, manter exatamente o comportamento atual (`r.label` + descrição auxiliar à direita).
- Sem mudanças em estado, cálculos, persistência ou em `bookletKit.ts`.

Resultado: a linha do kit passa a mostrar o **item realmente selecionado** como nome principal, com o badge "TROCADO" indicando que foi substituído em relação à sugestão do kit. Sem ambiguidade visual.
