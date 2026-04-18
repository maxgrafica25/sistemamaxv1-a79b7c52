

## Diagnóstico

O erro `IDLE_TIMEOUT 150s` aparece porque:

1. **Em massa processa URLs sequencialmente** (`for` loop com `await`), então as 4 URLs somam tempo. Mas o timeout de 150s é **por request**, então isso sozinho não deveria estourar — exceto que…
2. **Cada chamada individual da função ficou pesada** com o fallback visual: Firecrawl com `waitFor 8000ms` + 2 scrolls + screenshot + Gemini 2.5 Pro multimodal pode levar facilmente 60–120s.
3. Quando o Firecrawl trava (página lenta, anti-bot), a função fica esperando até o gateway encerrar com 504.

Pelos logs: ANS e FuturaIM passam (`low=false`, sem visual). Atual Card e Imprima Rápido caem em `low=true` → entram no caminho visual lento → estouram o timeout.

## Plano

**1. Adicionar timeouts internos na função `detect-price-tiers`**
- `AbortController` no fetch do Firecrawl com limite de 60s.
- `AbortController` no fetch do Lovable AI (visual) com limite de 50s.
- Se qualquer um estourar, retorna o que tiver até o momento (parcial) em vez de travar.

**2. Reduzir o peso do scrape**
- Tirar 1 dos 2 scrolls e baixar `waitFor` total para ~5000ms (3000 + 2000).
- Manter screenshot só quando realmente cair em baixa confiança (já é o caso, mantém).

**3. Paralelizar o "Em massa" no client**
- Em vez de `for await`, usar `Promise.allSettled` com concorrência limitada (3 simultâneas) para que cada URL tenha seu próprio timeout de 150s e o lote total termine mais rápido.
- Atualiza `bulkItems` conforme cada Promise resolve.

**4. Mensagem de erro mais clara**
- Quando der timeout, mostrar "Tempo esgotado — tente re-detectar este site individualmente" em vez de só "Edge Function returned a non-2xx status code".

**5. Replicar timeouts em `scheduled-sync-firecrawl`**
- Mesma blindagem para o cron não travar.

## Arquivos afetados

- `supabase/functions/detect-price-tiers/index.ts` — AbortController nos fetches, `waitFor` reduzido, retorno parcial em timeout.
- `supabase/functions/scheduled-sync-firecrawl/index.ts` — mesmos timeouts.
- `src/components/monitoramento/NovoSiteDialog.tsx` — `handleBulkDetect` com pool de 3 paralelas + tratamento de erro de timeout.

Sem mudanças no banco. Após o deploy, o usuário pode reabrir "Em massa" → "Detectar todos" e o lote deve concluir mesmo se 1–2 URLs forem lentas.

