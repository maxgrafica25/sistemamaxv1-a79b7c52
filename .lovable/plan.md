

# Corrigir formato do código enviado ao Browserless `/function`

A chamada está retornando 400 com `module is not defined` porque a API atual do Browserless `/function` espera ESM (`export default`) em vez do CommonJS (`module.exports`) usado hoje em `ATUALCARD_FN_SOURCE`.

## Mudança em `supabase/functions/scrape-prices/index.ts`

### 1) Trocar a assinatura da função injetada

No template literal `ATUALCARD_FN_SOURCE` (linha 240):

- Trocar:
  ```
  module.exports = async ({ page, context }) => { ... }
  ```
- Por:
  ```
  export default async function ({ page, context }) { ... }
  ```

Todo o miolo (goto + waitForFunction + page.evaluate + return) permanece igual. Só muda a "casca" exterior.

### 2) Garantir que o retorno funciona em ambos formatos

A resposta do Browserless `/function` em ESM costuma vir como `{ data, type }` igual à versão antiga, então `fetchViaBrowserlessFunction` (que já faz `json?.data ?? json`) continua compatível — sem mudança.

### 3) Log mais claro do erro 400 do Browserless

Hoje o `console.warn` de erro só mostra o texto truncado. Adicionar no `fetchViaBrowserlessFunction` um log explícito quando `r.status === 400` mostrando os primeiros 300 chars do corpo (`Browserless /function 400: <body>`) para facilitar diagnóstico futuro caso a API mude de novo.

## O que não muda

- `scrapeAtualCardDataLayerFallback` segue como rede de segurança (1 tier via `dataLayer`).
- Demais fornecedores (ANS, Futura IM, Imprima Rápido) continuam intactos.
- UI de `NovoSiteDialog` e schema de `site_precos_tiers` sem alteração.
- Tempo esperado: 8–15s por URL Atual Card.

## Resultado esperado

- Chamada `/function` deixa de retornar 400.
- Logs passam a mostrar `[atualcard /function] tiers=12 counts={...}`.
- Testar a URL do flyer 14×10 cm grava as ~12 faixas (1.000 → 1.000.000) em `site_precos_tiers`.
- Se algum dia a Atual Card mudar o DOM, o fallback dataLayer continua salvando ao menos 1 tier.

## Arquivo afetado

| Ação | Arquivo |
|------|---------|
| Editar | `supabase/functions/scrape-prices/index.ts` (trocar `module.exports` por `export default` em `ATUALCARD_FN_SOURCE`; melhorar log de erro 400 em `fetchViaBrowserlessFunction`) |

