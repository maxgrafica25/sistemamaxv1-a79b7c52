

# Validação end-to-end do sistema de backup

## Estado atual constatado

- **`backup_runs` está vazio** (0 registros). Nenhum dos 3 formatos foi disparado ainda — então não há o que "confirmar no histórico" sem antes gerar.
- Tentar chamar `backup-database` e `backup-storage` por curl direto retorna **401 Unauthorized** (esperado: as funções validam JWT + `is_profile_admin` antes de instanciar o service-role). Isso confirma que a proteção admin está ativa, mas significa que a única forma de gerar um backup real é a partir do navegador autenticado.

## O que vou executar (após aprovação)

1. **Abrir o preview autenticado** em `/configuracoes` no viewport atual (394x625), trocar para a aba **"Backup & Exportação"**.
2. **Clicar "Gerar backup SQL"** → aguardar download → ler o arquivo baixado e confirmar:
   - Header contém os 4 `CREATE EXTENSION IF NOT EXISTS` (`pgcrypto`, `"uuid-ossp"`, `pg_net`, `pg_cron`).
   - Ordem dos blocos: EXTENSIONS → FUNCTIONS → TABLES → INDEXES → DATA → FOREIGN KEYS → RLS/POLICIES → TRIGGERS → AUTH_USERS_JSON.
   - Bloco `AUTH_USERS_JSON` presente como comentário.
3. **Clicar "Backup JSON"** → confirmar download e que o JSON tem `schema.extensions: ["pgcrypto","uuid-ossp","pg_net","pg_cron"]`.
4. **Clicar "Exportar lista de arquivos (Storage)"** → confirmar download e que o JSON tem:
   - `generated_at`, `expires_at` (~24h à frente).
   - `buckets["chat-attachments"]` e `buckets["maintenance-attachments"]` como arrays.
   - Cada item com `path`, `size`, `mime_type`, `signed_url` (URL https válida com `?token=…`).
   - `totals.files` e `totals.bytes` consistentes.
5. **Re-consultar `backup_runs`** via `supabase--read_query` e confirmar 3 linhas novas:
   - `format='sql'`, `format='json'`, `format='storage-json'`
   - todas com `status='success'` e `size_bytes > 0`
   - `created_by` = uuid do admin logado
6. **Conferir `admin_operations_log`** — confirmar 3 entradas correspondentes (`backup-database` x2 + `backup-storage` x1).
7. **Logs das edge functions** (`supabase--edge_function_logs` em `backup-database` e `backup-storage`) para checar erros silenciosos no stream (ex.: `read failed for X`).

## Pré-requisito do usuário

A edge function precisa do JWT do admin logado. Confirme que **você está logado como admin** no preview antes de eu rodar a validação. Se o preview mostrar a tela de login, vou parar e pedir login manual antes de continuar.

## Saída esperada

Relatório com 3 verdes/vermelhos:
- [ ] CREATE EXTENSION presente no SQL
- [ ] storage manifest com signed URLs válidas
- [ ] backup_runs registrou os 3 formatos com tamanho e status corretos

Se algum falhar, identifico a causa nos logs e proponho correção em mensagem separada (não corrijo dentro desta validação).

## Fora de escopo

- Não vou baixar de fato os blobs do storage (apenas validar que as URLs assinadas têm formato válido).
- Não vou restaurar o SQL em outro Postgres — esse teste é o runbook completo (Fase 1+2), não cabe aqui.

