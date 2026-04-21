

# Corrigir crash das edge functions de backup

## Causa raiz

`backup-database/index.ts` e `backup-storage/index.ts` importam `@supabase/supabase-js@2.45.0` e chamam `userClient.auth.getClaims(token)`. Esse método não existe nessa versão → `TypeError` na linha de validação de admin → stream nunca abre → browser reporta "Failed to fetch".

Confirmado nos logs:
```
TypeError: userClient.auth.getClaims is not a function
  at backup-database/index.ts:110
  at backup-storage/index.ts:91
```

Config (`verify_jwt = false`) e deploy estão corretos — o crash é puramente em runtime.

## Correção

Substituir `getClaims(token)` por `getUser()` nas duas funções. `getUser()` existe desde versões antigas do SDK, valida o JWT contra o servidor Auth e retorna `data.user.id` (equivalente a `claims.sub`).

### `supabase/functions/backup-database/index.ts` (linhas ~108-118)

Trocar:
```ts
const token = authHeader.replace("Bearer ", "");
const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
if (claimsErr || !claims?.claims?.sub) { ...401... }
const userId = claims.claims.sub as string;
```

Por:
```ts
const { data: userData, error: userErr } = await userClient.auth.getUser();
if (userErr || !userData?.user?.id) { ...401... }
const userId = userData.user.id;
```

### `supabase/functions/backup-storage/index.ts` (linhas ~89-99)

Mesma substituição, mesma lógica.

## Validação após correção

1. Deploy das duas funções (`supabase--deploy_edge_functions`).
2. `supabase--curl_edge_functions` em `/backup-database?format=sql` (sem auth) → confirmar 401 ainda funciona.
3. Verificar `supabase--edge_function_logs` — não deve haver mais `TypeError`.
4. Pedir ao usuário para clicar os 3 botões em `/configuracoes` e confirmar downloads + registros em `backup_runs`.

## Arquivos afetados

| Ação | Arquivo |
|---|---|
| Editar | `supabase/functions/backup-database/index.ts` (substituir `getClaims` por `getUser`) |
| Editar | `supabase/functions/backup-storage/index.ts` (idem) |

## Fora de escopo

- Atualizar versão do `@supabase/supabase-js` — risco de quebrar outros métodos usados (storage admin, listUsers). `getUser()` é a correção mínima.
- Avisos de acessibilidade do `DialogContent` (faltando `DialogTitle`/`Description`) — não bloqueiam funcionalidade, tratar separado se desejado.

