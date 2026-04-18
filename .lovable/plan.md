
## Diagnóstico

Dois problemas combinados:

1. **`SCRAPER_WORKER_URL` está sem `https://`** → `new URL()` no Deno falha com "Invalid URL". Tem que ser `https://import-wizard-production.up.railway.app`, não `import-wizard-production.up.railway.app`.

2. **O domínio `import-wizard-production.up.railway.app` não é o worker** — é o nome padrão "import-wizard" do template Railway. Provavelmente nenhum serviço com a pasta `scraper-worker/` foi deployado ainda, ou foi criado um projeto vazio.

## Plano

### Passo 1 — Tornar a edge function tolerante a URL sem protocolo
Em `supabase/functions/scrape-via-worker/index.ts`, normalizar `workerUrl`:
- Se não começa com `http://` ou `https://`, prefixar `https://`.
- Validar com `new URL()` e devolver erro claro se inválida.
- Adicionar log com a URL final (sem o secret) pra debug.

### Passo 2 — Validar se o worker está realmente respondendo
A edge function `scrape-via-worker` faz um `GET /health` antes do `POST /scrape`. Se o health não responder JSON `{status:"ok"}`, devolve erro:
> "Worker não encontrado em <URL>. Verifique se o serviço scraper-worker foi deployado no Railway."

Isso evita confundir "URL errada" com "site bloqueia scraping".

### Passo 3 — Mensagens mais claras na UI
Em `NovoSiteDialog.tsx`, quando o erro contiver "Worker não" ou "Invalid URL", mostrar instrução curta:
> "Configure o Worker no Railway e atualize SCRAPER_WORKER_URL com a URL completa (https://...)."

### Passo 4 — Atualizar README do `scraper-worker/`
Reforçar:
- A URL do Railway deve incluir `https://`.
- Como descobrir a URL correta (Settings → Networking → Public Domain).
- Como testar o health: `curl https://SUA-URL/health`.

### Passo 5 — Confirmar com você o estado real do Railway
Antes de prosseguir, preciso saber: **você já criou um serviço no Railway apontando para a pasta `scraper-worker/`?** Se sim, qual a URL pública gerada em "Settings → Networking → Public Domain"? O domínio `import-wizard-production.up.railway.app` parece ser placeholder de outro template.

## Arquivos
- `supabase/functions/scrape-via-worker/index.ts` (normalização + health check)
- `src/components/monitoramento/NovoSiteDialog.tsx` (mensagem de erro mais útil)
- `scraper-worker/README.md` (instruções reforçadas)

## Resultado esperado
- Se o worker estiver deployado e a URL setada com ou sem `https://`: funciona.
- Se a URL estiver errada ou worker offline: erro claro indicando exatamente o que corrigir, em vez de "Invalid URL".
