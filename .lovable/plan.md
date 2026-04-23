

# Eventos não aparecem no Google Calendar — token sem permissão de escrita

## Diagnóstico

Os logs do worker mostram o erro real, repetido em loop:

```
403 PERMISSION_DENIED
"Request had insufficient authentication scopes."
reason: ACCESS_TOKEN_SCOPE_INSUFFICIENT
method: calendar.v3.Events.Insert
```

Ou seja: o código está pedindo o escopo certo (`calendar.events`) no `google-oauth-init`, mas **o token Google que está salvo hoje na sua conta não inclui esse escopo**. Provavelmente foi gerado em uma reconexão antiga (quando o escopo era só `userinfo.email`) ou o Google reaproveitou um consentimento prévio sem incluir o novo escopo.

A fila `gcal_sync_queue` tem itens travados batendo 403 toda vez que o cron roda — daí "antes funcionou e agora parou".

## O que vou fazer

### 1. Forçar reconsentimento ao reconectar
Em `supabase/functions/google-oauth-init/index.ts`, garantir que o pedido de autorização force a tela de consentimento mostrando os escopos atuais. O parâmetro `prompt: "consent"` já está lá, mas vou adicionar também `include_granted_scopes: "false"` para impedir o Google de devolver um token reaproveitado sem o `calendar.events`.

### 2. Validar escopos no callback
Em `supabase/functions/google-oauth-callback/index.ts`, depois de trocar o `code` por token, checar se o campo `scope` da resposta inclui `https://www.googleapis.com/auth/calendar.events`. Se não incluir, **não salvar** o token e redirecionar com `?gcal=error&reason=missing_calendar_scope` para a Júlia avisar claramente.

### 3. Limpar o token atual e a fila travada
Após você desconectar e reconectar:
- a row antiga de `user_google_tokens` é apagada pelo `google-disconnect` (já existente);
- vou também marcar como processados os itens antigos da `gcal_sync_queue` que estão batendo 403, pra parar o loop de erro nos logs e não reenviar lembretes antigos.

Isso será feito via migration de uma vez só:
```sql
UPDATE public.gcal_sync_queue
SET processed_at = now(),
    last_error = 'cleared: scope reconnect'
WHERE processed_at IS NULL
  AND last_error LIKE '%insufficient authentication scopes%';
```

### 4. Passo manual seu (essencial)
Depois que eu publicar as correções, você precisa:

1. Ir em **Configurações → Google Calendar → Desconectar**.
2. Clicar em **Conectar Google Calendar** de novo.
3. Na tela do Google, **marcar a permissão "Ver, editar, compartilhar e excluir permanentemente todos os calendários"** (ou equivalente). É essa marcação que estava faltando.
4. Voltar ao app — a partir daí, lembretes novos da Júlia vão pra agenda.

## Arquivos alterados

- `supabase/functions/google-oauth-init/index.ts` (forçar novo consent, sem reaproveitamento)
- `supabase/functions/google-oauth-callback/index.ts` (validar escopo recebido)
- Migration SQL para limpar a fila travada

## Fora do escopo

- Não vou mexer em `gcal-sync-worker`, `user_google_tokens`, schema de `reminders`, nem no fluxo da Júlia.
- Não vou tentar "reaproveitar" o token atual — ele precisa ser substituído pela reconexão manual.

