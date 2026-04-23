

# Desconectar Google Calendar Connector do Lovable

## O que vou fazer

Remover o connector do Google Calendar (linkado via Lovable Connectors) do projeto. Ele não é usado por nenhuma edge function — a sincronização da Júlia continua funcionando 100% pelo OAuth próprio em `user_google_tokens`.

## Passos

1. Listar as conexões do workspace pra achar o `connection_id` do Google Calendar connector.
2. Chamar `standard_connectors--disconnect` com esse ID — isso remove os secrets do projeto mas mantém a conexão disponível no workspace (caso outro projeto queira usar no futuro).

## O que NÃO muda

- Tabela `user_google_tokens` intacta.
- Edge functions `google-oauth-init`, `google-oauth-callback`, `google-disconnect`, `gcal-sync-worker` intactas.
- Card "Google Calendar" em **Configurações → Integrações** continua sendo o caminho oficial pra você (e cada colaborador) conectar.

## Próximo passo seu

Depois que eu desconectar, abrir **Configurações → Integrações → Conectar Google Calendar** dentro do app pra popular `user_google_tokens` e ativar a sync da Júlia.

