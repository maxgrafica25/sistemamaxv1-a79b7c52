

# Corrigir integração Browserless.io

A edge function está retornando 500 porque o health check em `GET /pressure?token=...` devolve 404. A API atual da Browserless não expõe mais `/pressure` publicamente nesse formato.

## Correções em `supabase/functions/scrape-prices/index.ts`

1. **Remover o health check `/pressure`** — não é confiável e está bloqueando todas as chamadas. Em vez disso, deixar o erro real do `/content` aparecer no retry (já existe retry 3x).
2. **Manter `POST /content?token=...`** — esse endpoint continua válido na Browserless v2 e é o que importa.
3. **Melhorar mensagem de erro do `/content`**: se vier 401 → "API key inválida"; 402 → "Cota excedida"; 429 → "Rate limit"; outros → repassar status + corpo.
4. **Verificação leve de token na inicialização**: testar 1x com `POST /content` numa URL simples (`https://example.com`) só se for o primeiro retry e falhar com auth — opcional, posso pular.

## Mudança mínima

Apenas remover a função `checkBrowserlessHealth` e a chamada que a usa em `scrapeMany`. O resto fica idêntico. Se a key estiver errada, o primeiro `fetchRenderedHtml` falha com 401 e a mensagem chega ao usuário via o `error` no resultado.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/scrape-prices/index.ts` (remover health check, melhorar erros HTTP) |

## Resultado esperado

- "Testar scraping" no `NovoSiteDialog` deixa de retornar 500.
- Se a `BROWSERLESS_API_KEY` for válida, scraping roda normalmente.
- Se for inválida, vem mensagem clara ("API key inválida" ou "Cota excedida") em vez de "pressure HTTP 404".

