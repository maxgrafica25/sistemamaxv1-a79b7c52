
Objetivo: fazer a detecção funcionar de forma confiável para Atual Card e Imprima Rápido, sem estourar timeout e sem quebrar o modal.

Diagnóstico real:
- O problema principal não é mais de sintaxe/deploy.
- As chamadas que falham hoje retornam `500` com `Firecrawl timeout/abort`.
- O fluxo atual tenta um scrape pesado demais logo de cara (`json + screenshot + waits + scroll + fallback visual`), então para esses domínios ele morre antes mesmo de chegar na extração útil.
- Pelas páginas lidas, o HTML existe e é grande, mas o markdown é pobre. Isso indica que as faixas provavelmente estão em HTML/estado serializado da página, não no markdown curto.
- Há também um problema de estabilidade no modal: o `Badge` gera warning de `ref`, então vale corrigir isso junto para evitar erro visual no preview.

Plano de correção:

1. Trocar a estratégia de extração para “HTML primeiro, visual por último”
- Fazer a função tentar primeiro um scrape leve, com timeout menor e sem screenshot:
  - formatos: `html` + `markdown`
  - sem fallback visual nessa primeira etapa
- Extrair as faixas a partir do HTML bruto e de blocos serializados da página.
- Só usar screenshot + IA como último recurso.

2. Criar parsers por domínio para os sites problemáticos
- Implementar parser específico para:
  - `atualcard.com.br`
  - `imprimarapido.com.br`
- Procurar no HTML:
  - tabelas de quantidade/preço
  - JSON embutido em `<script>`
  - arrays/objetos com quantidade e valor
  - atributos `data-*`
- Isso muda a abordagem de “OCR lento” para “leitura estruturada do HTML”, que deve ser muito mais rápida e completa nesses dois sites.

3. Manter parser genérico para os sites que já funcionam
- Preservar o fluxo atual para FuturaIM / ANS e outros casos estáveis:
  - validação por texto
  - regex em markdown
  - merge conservador
- Assim evitamos regredir onde já está correto.

4. Rebaixar o fallback visual
- Deixar o fallback por screenshot apenas quando:
  - não houver parser específico para o domínio
  - HTML + markdown não trouxerem tiers suficientes
- Em lote (“Em massa”), evitar fallback visual pesado por padrão, para não voltar o timeout.

5. Melhorar tratamento de erro no modal
- Garantir que falha de uma URL nunca derrube a tela.
- Mostrar erro por item e seguir com os demais.
- Corrigir o componente `Badge` para suportar `ref` corretamente e remover o warning atual.

6. Aplicar a mesma lógica na sincronização automática
- Replicar o pipeline novo também em `scheduled-sync-firecrawl`, para que o comportamento manual e automático fique igual.

Arquivos a ajustar:
- `supabase/functions/detect-price-tiers/index.ts`
- `supabase/functions/scheduled-sync-firecrawl/index.ts`
- `src/components/ui/badge.tsx`
- `src/components/monitoramento/NovoSiteDialog.tsx` (apenas se precisar reforçar a estabilidade do erro por item)

Resultado esperado após a implementação:
- Atual Card: detectar todas as faixas sem timeout
- Imprima Rápido: detectar todas as faixas sem timeout
- FuturaIM e ANS: continuar corretos
- Modal “Em massa”: continuar aberto e utilizável mesmo quando 1 site falhar

Sem mudanças no banco.
