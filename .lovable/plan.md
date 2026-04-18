

## Diagnóstico

Atual Card mostra **8 faixas** (1.000 → 50.000) mas detectou só **2**. Imprima Rápido mostra **8** mas detectou só **1**. FuturaIM detectou 8 corretamente. Causas prováveis na função `detect-price-tiers`:

1. **Prompt fraco** — não enfatiza "extraia TODAS as linhas, não pule nenhuma".
2. **Validação muito agressiva** (`numberAppearsIn`) — pode estar descartando tiers válidos sem o usuário ver. Os logs do Firecrawl mostram só "booted", sem detalhes de quantos tiers vieram vs. quantos foram descartados.
3. **`waitFor: 2000` curto** — sites com preços carregados via JS (Atual Card carrega valores dinamicamente) podem não ter renderizado a tabela completa.
4. **Schema sem `minItems`** — modelo pode "resumir" e devolver só 2 linhas se achar suficiente.
5. **Falta de fallback** — se o JSON extraction falha, não tenta extrair do markdown bruto (que sempre tem os números).

## Plano

Endurecer `supabase/functions/detect-price-tiers/index.ts` (e replicar em `scheduled-sync-firecrawl/index.ts`):

**1. Prompt mais explícito**
- "Extraia **TODAS** as linhas da tabela de preços, sem exceção. Se a página tem 8 quantidades, retorne 8 tiers. Não resuma, não pule, não selecione."
- Adicionar exemplo: "Se vir '1.000 R$ 180,00' e '2.500 R$ 328,00' e '5.000 R$ 497,00'..., retorne os três."

**2. Aumentar `waitFor` para 4000ms** e manter `onlyMainContent: false` para garantir renderização de tabelas dinâmicas (Atual Card).

**3. Fallback de extração via markdown**
- Após receber o JSON do Firecrawl, **sempre** rodar um parser regex no markdown procurando padrões `(\d{1,3}(?:\.\d{3})*)\s*.{0,40}?R\$\s*([\d.,]+)` para detectar faixas adicionais que o JSON tenha perdido.
- Mesclar com os tiers do JSON, deduplicando por `quantidade`.

**4. Logging detalhado**
- `console.log` quantos tiers vieram do JSON, quantos do regex, quantos validados, quais foram descartados e por quê. Permite debugar via `edge_function_logs` quando o usuário reportar perda.

**5. Relaxar validação**
- Hoje, se `numberAppearsIn` falha tanto no markdown quanto no `texto_original`, descarta. Vou aceitar o tier se **a quantidade OU o preço** aparecer no markdown (não ambos), reduzindo falsos negativos. Tiers vindos do regex já estão por definição validados.

**6. Replicar em `scheduled-sync-firecrawl`** para que sincronizações automáticas também não percam faixas.

## Arquivos afetados

- `supabase/functions/detect-price-tiers/index.ts` — novo prompt, fallback regex, logging, validação relaxada, `waitFor: 4000`.
- `supabase/functions/scheduled-sync-firecrawl/index.ts` — mesmas mudanças no helper `scrapeTiers`.

Sem mudanças no banco. Após o deploy, o usuário pode reabrir o diálogo "Em massa" e clicar "Detectar todos" novamente para reprocessar as URLs problemáticas.

