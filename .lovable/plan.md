# Fase 2 + Fase 3: Pacote VPS completo

## O que falta pra "apertar um botão e instalar"

Hoje o pacote já traz banco, usuários (sem senha) e cron jobs. Falta:
- Os **arquivos** (anexos de chat, manutenção e orçamentos)
- O **docker-compose** com toda a stack rodando (Postgres, Auth, Storage, Realtime, API, Caddy)
- O **script instalar.sh** que faz tudo sozinho na VPS
- As **edge functions** empacotadas
- Backup automático diário já configurado dentro do docker-compose

## Fase 2 — Incluir Storage no pacote

Baixar todos os arquivos dos 3 buckets (`chat-attachments`, `maintenance-attachments`, `quote-attachments`) e colocá-los dentro do ZIP, em `storage/<bucket>/<caminho>`.

- A edge function `generate-vps-package` lista cada bucket e baixa os arquivos
- Se o total passar de ~200 MB, ativa modo "pacote pesado": mostra aviso na UI
- Gera `storage/manifest.json` com lista de tudo (útil pra conferência)

**Risco controlado:** se você tiver muitos GB de anexos, o pacote vira grande demais pra edge function (limite ~256 MB de RAM). Solução: a função detecta o tamanho antes e, se for muito grande, gera 2 arquivos — `pacote-base.zip` (código + DB) e `pacote-storage.zip` (só arquivos). Você baixa os dois e o `instalar.sh` aceita ambos.

## Fase 3 — Stack Docker + script de instalação

### `docker-compose.yml` incluído no ZIP
Sobe tudo que o Lovable Cloud te dá hoje:

| Serviço | O que faz |
|---|---|
| `postgres` | Banco de dados (volume persistente) |
| `gotrue` | Autenticação (login/senha + Google) |
| `storage-api` | Servidor de arquivos |
| `realtime` | Atualizações em tempo real (chat, notificações) |
| `postgrest` | API REST automática do banco |
| `kong` | Gateway que junta tudo numa URL só |
| `caddy` | HTTPS automático com Let's Encrypt |
| `edge-runtime` | Roda suas 16 edge functions |
| `backup` | Cron diário que faz `pg_dump` + tar dos arquivos |

### `instalar.sh` — o "botão" na VPS

```text
1. Verifica Docker instalado
2. Pergunta o domínio (ex: sistema.suaempresa.com)
3. Gera senhas e chaves JWT automaticamente
4. Preenche .env
5. docker compose up -d
6. Espera Postgres ficar pronto
7. Restaura database.sql
8. Importa usuários (auth-users.json) → dispara email de reset
9. Sobe arquivos do storage/
10. Aplica cron-jobs.sql
11. Deploya as 16 edge functions
12. Mostra URL final + checklist (DNS, Google OAuth)
```

### `checklist-pos-instalacao.md`
- Apontar DNS do domínio pro IP da VPS
- Criar credencial OAuth nova no Google Cloud (~10 min, instruções com prints)
- Testar login de 1 usuário
- Confirmar que os crons rodaram

### Backup automático já incluído
O serviço `backup` no docker-compose roda todo dia às 3h:
- `pg_dump` do banco → `/backups/db-YYYY-MM-DD.sql.gz`
- `tar` dos arquivos → `/backups/storage-YYYY-MM-DD.tar.gz`
- Mantém últimos 14 dias, apaga o resto

Assim, mesmo depois de migrado, você nunca perde dados.

## Tamanho final estimado

| Item | Tamanho |
|---|---|
| Database SQL | ~5 MB |
| Auth + cron + configs | ~50 KB |
| Edge functions (16) | ~2 MB |
| docker-compose + Caddyfile + scripts | ~30 KB |
| **Base** | **~7 MB** |
| Storage (depende do seu uso) | varia (estimo 50-500 MB hoje) |

No bucket `vps-packages` continuam só os **3 últimos pacotes** com expiração de 7 dias — então no máximo ~1.5 GB ocupados temporariamente, e zera sozinho.

## Ordem de execução

1. **Fase 2.1** — função baixa storage e inclui no ZIP (com modo "pacote pesado" se passar de 200 MB)
2. **Fase 2.2** — UI mostra tamanho estimado antes de gerar
3. **Fase 3.1** — gerar `docker-compose.yml`, `Caddyfile`, `kong.yml`, `.env.exemplo` no ZIP
4. **Fase 3.2** — gerar `instalar.sh` com toda a orquestração
5. **Fase 3.3** — empacotar as 16 edge functions
6. **Fase 3.4** — incluir serviço de backup diário no compose
7. **Fase 3.5** — atualizar `INSTALL.md` e gerar `checklist-pos-instalacao.md`

## O que continua sendo manual (inevitável)

1. Comprar/ter VPS com Docker (Hostinger, DigitalOcean, Contabo — 4GB RAM, ~R$30-60/mês)
2. Apontar DNS do domínio
3. Criar credencial Google OAuth nova (10 min)
4. Cada usuário recebe email de reset de senha no 1º acesso

Tudo o resto: **1 comando** (`bash instalar.sh`) e ~5 minutos de espera.

## Pergunta antes de implementar

Quer que eu já implemente as duas fases de uma vez (vai gerar bastante código), ou prefere ir por partes — primeiro storage (Fase 2), você testa, e depois eu sigo com docker-compose + instalar.sh (Fase 3)?
