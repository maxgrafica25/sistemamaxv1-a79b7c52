

## Diagnóstico definitivo

Testei o Firecrawl direto contra a Atual Card e Imprima Rápido com `waitFor: 8000`, scroll, ações de espera e até modo `stealth`. Resultado em **todos os casos**:
- HTML retornado: ~120-190 KB, mas **zero ocorrências de "R$"**, **zero `<script>`**, **zero `<td>`/`<option>`**, **zero "unidade"**.
- Markdown: 130-180 chars (só ícones de header).

Conclusão: o problema **não é o parser**. O Firecrawl simplesmente não está conseguindo renderizar o conteúdo de preço dessas duas páginas — o conteúdo só aparece após interações específicas (provavelmente seleção de região/CEP, ou um framework JS muito específico que o Chrome do Firecrawl não está executando).

Por isso todas as estratégias anteriores falharam: você não pode parsear dados que não estão no HTML retornado.

## Plano

**1. Confirmar a hipótese com diagnóstico embutido**
Adicionar logging detalhado que mostra, no log da função:
- Se `R$` aparece no HTML
- Se há scripts/tabelas
- Quantos chars úteis de markdown vieram
Assim, no futuro, conseguimos ver imediatamente "Firecrawl não rendereizou" vs "regex não matchou".

**2. Tratar "página vazia" como erro claro, não como "sem tabela"**
Se o HTML não contém **nenhum** sinal de preço (`R$`, `unidade`, números de quantidade plausíveis), retornar uma mensagem explícita:
> "O Firecrawl não conseguiu renderizar a página de preços deste site. Provável bloqueio anti-bot ou conteúdo carregado por interação."
Em vez do confuso "Sem tabela detectada".

**3. Adicionar fallback via screenshot SEMPRE para os domínios problemáticos**
Para `atualcard.com.br` e `imprimarapido.com.br`, **pular direto** para o caminho visual (screenshot + Gemini), porque sabemos que o HTML nunca virá. Isso evita gastar tempo tentando parsers que não vão funcionar.
- Manter `allowVisual: false` no modo "Em massa" para esses domínios também (o screenshot é caro), mas mostrar mensagem clara no item: "Use 'Re-detectar individualmente' para este site".
- No modo individual: pedir screenshot da Atual Card / Imprima Rápido com `fullPage: true` e enviar para Gemini.

**4. Aceitar que detecção automática pode falhar nesses sites**
Adicionar no diálogo um botão **"Inserir faixas manualmente"** quando a detecção falha. O usuário cola/digita as faixas (qtd → preço) que vê na tela. Salva igual ao fluxo automático.
Isso garante que o sistema seja **utilizável** mesmo quando a página é hostil a scraping.

**5. Não mexer em ANS e FuturaIM**
Esses estão funcionando. Só adicionar o logging melhorado.

## Arquivos a ajustar

- `supabase/functions/detect-price-tiers/index.ts` — diagnóstico melhorado, fast-path visual para domínios bloqueados, mensagem de erro clara.
- `src/components/monitoramento/NovoSiteDialog.tsx` — botão "Inserir faixas manualmente" quando detecção retorna 0 faixas, mensagem mais útil em caso de página vazia.
- `supabase/functions/scheduled-sync-firecrawl/index.ts` — só replicar o diagnóstico (sem visual no cron, é caro demais).

## Resultado esperado

- **Atual Card / Imprima Rápido**: ou virá pelo screenshot (modo individual), ou o usuário digita as 8 faixas manualmente em ~30s. Não fica mais travado.
- **ANS / FuturaIM**: continuam idênticos.
- **Em massa**: para de tentar inutilmente esses dois sites e marca claramente "requer entrada manual".

Sem mudanças no banco.

