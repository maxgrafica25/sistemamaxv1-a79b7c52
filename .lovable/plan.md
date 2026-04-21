

# Validação dos artefatos de infra para deploy em VPS

Rodar as 4 validações estáticas planejadas e reportar o resultado de cada uma. Read-only mode não permite executar comandos — preciso aprovação para rodar shell.

## O que vou executar

1. **`docker compose config > /dev/null`** — valida sintaxe + resolução de variáveis do `docker-compose.yml` (com `.env.example` copiado pra `.env` temporário, já que `.env` real não existe no sandbox).
2. **`docker build -t lovable-frontend-test .`** — confirma que o Dockerfile compila o frontend de ponta a ponta (Bun install + Vite build + Nginx stage). Pode levar 2-4 min.
3. **`deno check scripts/generate-jwt.ts`** — confirma que o script tipa sem erro.
4. **Cross-check de variáveis** — script `grep` que pra cada variável listada em `docs/deployment-vars.md` confirma se ela aparece em `docker-compose.yml` (ou justifica ausência: variáveis `VITE_*` aparecem como `build.args`, não como `environment`).

## Formato do relatório final

Tabela com 4 linhas (uma por validação) + status (✅/❌) + saída relevante. Pra o cross-check de variáveis, lista de qualquer variável documentada que não apareça no compose (esperado: zero discrepâncias).

## Se algo falhar

Reporto o erro exato e proponho correção em **mensagem separada** — não corrijo dentro desta validação (mesmo padrão da validação anterior do backup).

## Fora de escopo

- Não vou subir o stack (`docker compose up`) — sandbox não tem domínio público nem portas 80/443 expostas, e Caddy ia falhar tentando emitir TLS.
- Não vou testar `scripts/generate-jwt.ts` em runtime (já validei no design que usa só APIs nativas Deno + Web Crypto).

