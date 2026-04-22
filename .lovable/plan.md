

# Júlia → Google Calendar (one-way, por usuário)

## O que muda para você

- Em **Configurações** aparece um botão **"Conectar Google Calendar"**. Cada usuário (você, Juliano, Marcelle…) clica e autoriza com a própria conta Google. Pode desconectar a qualquer momento.
- Depois de conectado, **todo lembrete que a Júlia criar para você** vira automaticamente um evento na **sua** Google Agenda — com título, descrição, horário e lembrete nativo do Google (notificação no celular/desktop).
- **Editar/excluir lembrete na Júlia** → atualiza/remove o evento no Google.
- **Mexer no evento direto no Google** → não volta pra cá (one-way, decisão sua).
- Quem não conectou continua usando só o sininho interno, sem mudança.

## Por que OAuth próprio (não conector da Lovable)

O conector "Google Calendar" da Lovable autentica **uma conta só** (a do desenvolvedor). Como você quer que **cada usuário** ligue a **própria** conta, precisamos de OAuth multi-usuário com credenciais nossas no Google Cloud Console.

**O que você vai precisar fazer (uma vez só):**
1. Criar um projeto no Google Cloud Console.
2. Ativar a Google Calendar API.
3. Configurar tela de consentimento OAuth (modo "External", scopes `calendar.events`).
4. Criar credencial OAuth Client ID tipo "Web Application" e me passar o **Client ID** e **Client Secret**.
5. Adicionar como redirect URI a URL do callback (vou te dar a URL exata depois de criar o endpoint).

Eu te guio passo a passo quando chegar a hora — é uns 10 minutos no console do Google.

## Arquitetura

```text
Júlia cria lembrete
    ↓
reminders-api (insere em `reminders`)
    ↓
trigger Postgres → enfileira em `gcal_sync_queue`
    ↓
edge function `gcal-sync-worker` (cron 1min)
    ↓
busca tokens do user em `user_google_tokens` (refresh se preciso)
    ↓
POST/PATCH/DELETE em calendar.events
    ↓
salva `google_event_id` de volta no reminder
```

## Mudanças técnicas

### 1. Nova tabela `user_google_tokens`
- `user_id` (FK auth, PK), `access_token`, `refresh_token`, `expires_at`, `scope`, `connected_at`, `email_google` (só pra mostrar "conectado como X").
- RLS: usuário só lê/deleta o próprio. Edge functions usam service role.
- Tokens criptografados em repouso via coluna `pgsodium` ou simplesmente confiando no encryption-at-rest do Postgres gerenciado (vou usar a 2ª opção — padrão Lovable Cloud).

### 2. Nova coluna em `reminders`
- `google_event_id text null` — guarda o ID do evento no Google pra permitir update/delete.
- `gcal_synced_at timestamptz null` — última sincronização bem-sucedida.

### 3. Nova tabela `gcal_sync_queue`
- `id`, `reminder_id`, `user_id`, `operation` ('create'|'update'|'delete'), `payload jsonb` (snapshot pra delete que perde o reminder), `attempts`, `last_error`, `created_at`, `processed_at`.
- Trigger em `reminders` AFTER INSERT/UPDATE/DELETE → enfileira (só se o user tem token salvo).

### 4. Novas edge functions

**`google-oauth-init`** (verify_jwt em código)
- Gera URL de autorização Google com `state` assinado contendo `user_id`. Retorna URL pro frontend redirecionar.

**`google-oauth-callback`** (verify_jwt = false, é redirect do Google)
- Recebe `code` + `state`, valida, troca por tokens, salva em `user_google_tokens`. Redireciona pra `/configuracoes?gcal=ok`.

**`google-disconnect`** (verify_jwt em código)
- Revoga o token no Google e apaga linha de `user_google_tokens`.

**`gcal-sync-worker`** (verify_jwt = false, cron a cada 1min)
- Lê até 50 itens pendentes da fila, ordena por `created_at`.
- Para cada um: refresh do access token se vencido; chama Calendar API; em sucesso marca `processed_at` e atualiza `google_event_id` no reminder; em falha incrementa `attempts` (descarta após 5).

### 5. Frontend — `Configuracoes.tsx`
Nova seção **"Integrações"** com card Google Calendar:
- Não conectado: botão "Conectar Google Calendar" → chama `google-oauth-init`, redireciona.
- Conectado: mostra email Google + "Desconectar" + última sync.

### 6. Recorrência → eventos recorrentes do Google
- `daily/weekly/monthly` viram `RRULE:FREQ=DAILY/WEEKLY/MONTHLY` no Google. Sem precisar criar 1 evento por ocorrência.

### 7. Secrets necessárias
- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI` (URL do callback)

Vou pedir essas no momento certo via add_secret.

## Validação após deploy

1. **Conectar**: clicar "Conectar Google Calendar" → Google pede permissão → volta pra Configurações com "✓ Conectado como seu@email.com".
2. **Criar lembrete**: pedir pra Júlia "me lembra dentista amanhã 14h, 1h antes" → 30s depois aparece evento "Dentista" amanhã 13h-13h30 na sua agenda Google, com lembrete nativo.
3. **Editar**: deletar lembrete pelo sininho → evento some do Google em até 1min.
4. **Recorrência**: criar lembrete diário → vira 1 evento recorrente no Google (não 30 eventos).
5. **Desconectar**: clicar desconectar → linha some, lembretes futuros param de sincronizar (os já criados ficam no Google).
6. **Multi-usuário**: Marcelle conecta a conta dela; lembretes dela vão pra agenda dela, os seus continuam indo pra sua.
7. **Token expirado** (após 1h): próximo sync usa refresh_token automaticamente, sem você perceber.

## Fora deste escopo

- Bidirecional (mudanças no Google voltarem pra cá) — você pediu one-way.
- Importar eventos existentes do Google pra detecção de conflito (hoje conflito olha só `reminders` da Júlia).
- Convidados/participantes nos eventos.
- Múltiplas agendas (sempre cria na "primary" do usuário).

