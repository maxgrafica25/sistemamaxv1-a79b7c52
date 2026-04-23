

# Corrigir redirect URI do Google OAuth (Júlia → Calendar)

## Diagnóstico

O fluxo de "Conectar Google Calendar" está terminando em **403 do Google em `lovable.dev/projects/...`** porque o secret `GOOGLE_OAUTH_REDIRECT_URI` (e/ou o cadastro no Google Cloud Console) está apontando pra URL errada — não pra edge function `google-oauth-callback`.

## Correção em 2 lugares

### 1. Atualizar o secret `GOOGLE_OAUTH_REDIRECT_URI` no projeto

Trocar o valor atual pelo URL público da edge function de callback:

```
https://nxkmxslugblhsyohrrvm.supabase.co/functions/v1/google-oauth-callback
```

Faço isso via `update_secret` (precisa de aprovação sua).

### 2. Registrar o mesmo URL no Google Cloud Console

Você (manualmente) precisa abrir o OAuth Client correspondente ao `GOOGLE_OAUTH_CLIENT_ID` em **Google Cloud Console → APIs & Services → Credentials**, editar o client OAuth 2.0 e adicionar em **Authorized redirect URIs**:

```
https://nxkmxslugblhsyohrrvm.supabase.co/functions/v1/google-oauth-callback
```

Salvar. Esse passo é obrigatório — sem isso o Google continua recusando o callback.

### 3. Garantir que a edge function `google-oauth-callback` permite chamada anônima

O Google bate nessa URL **sem JWT do Supabase**, então a função precisa estar deployada com `verify_jwt = false`. Vou conferir o `supabase/config.toml` e ajustar se necessário.

### 4. Testar de novo

Depois de (1) + (2) deployados, abrir **Configurações → Integrações → Conectar Google Calendar**, escolher a conta Google → deve voltar pro app com `?gcal=ok` e popular `user_google_tokens`.

## Fora deste escopo

- Mudar o fluxo pra usar o connector gerenciado da Lovable (já decidimos manter OAuth próprio multi-usuário).
- Mexer em escopos do consent screen (já contemplam `calendar.events` + `userinfo.email`).

## Detalhes técnicos

- O secret `GOOGLE_OAUTH_REDIRECT_URI` é lido em `google-oauth-init` (montar URL de autorização) **e** em `google-oauth-callback` (trocar code por token). Os dois precisam usar o mesmo valor — daí salvar como secret único é correto.
- O `state` HMAC continua válido (não depende do redirect).
- Não há mudança em tabelas; `user_google_tokens` continua igual.

