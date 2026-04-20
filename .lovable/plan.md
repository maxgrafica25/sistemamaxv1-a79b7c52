

# Hardening da service role key no Lovable Cloud

Reduzir o blast radius de um vazamento da `SUPABASE_SERVICE_ROLE_KEY` sem migrar para Supabase Connection. A key em si não pode ser limitada (por design ela bypassa RLS — é o ponto dela), então a estratégia é **reduzir a superfície de uso** e **detectar abuso rápido**.

## Camada 1: Auditar onde a service role é realmente usada

Hoje os secrets disponíveis incluem `SUPABASE_SERVICE_ROLE_KEY`, e várias edge functions têm acesso automático a todos os secrets do projeto. Precisamos mapear **quais funções realmente precisam dela** vs. quais poderiam usar a anon key + RLS.

Edge functions atuais:
- `scrape-prices` — precisa (escreve em tabelas com RLS restritiva)
- `scrape-prices-cron` — precisa (orquestra a anterior)
- `sync-prices-webhook` — precisa (escreve via webhook externo)
- `check-reminders` — precisa (cria notificações para outros usuários)

**Ação**: revisar cada função e documentar inline (comentário no topo) **por que** precisa de service role. Funções que só leem dados públicos ou só escrevem dados do próprio usuário autenticado devem usar **anon key + JWT do usuário** em vez de service role:

```ts
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: req.headers.get("Authorization")! } },
});
// Agora roda com a identidade do usuário, RLS aplica normalmente
```

Resultado esperado: das 4 funções, idealmente reduzir para 2-3 que realmente precisam de service role.

## Camada 2: Wrapper centralizado com auditoria

Criar `supabase/functions/_shared/admin-client.ts` (módulo compartilhado importado pelas funções que ainda precisam de service role):

```ts
export function getAdminClient(context: { fnName: string; reason: string }) {
  // Log estruturado de cada criação de cliente service-role
  console.log(JSON.stringify({
    type: "admin_client_created",
    fn: context.fnName,
    reason: context.reason,
    timestamp: new Date().toISOString(),
  }));
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}
```

Com isso, todo uso aparece nos logs do Cloud → Edge Functions com formato pesquisável. Se houver abuso, dá pra ver na hora qual função está sendo invocada de forma anormal.

## Camada 3: Tabela de auditoria de operações privilegiadas

Criar tabela `admin_operations_log`:

| campo | tipo |
|---|---|
| id | uuid |
| created_at | timestamptz |
| function_name | text |
| operation | text (ex: "delete_user", "bulk_price_update") |
| target_table | text |
| target_count | integer |
| invoked_by | uuid (auth.uid() se houver, senão null) |
| metadata | jsonb |

RLS: apenas admins podem `SELECT`. INSERT só via service role (das próprias funções). Cada função service-role registra o que faz aqui antes de executar. Permite forensics se uma key vazar.

## Camada 4: Rate limiting nas edge functions expostas

`sync-prices-webhook` e `scrape-prices` aceitam requisições externas. Adicionar rate limiting por IP usando uma tabela `rate_limits` (window de 1 minuto, max N requests). Se uma key vazar e alguém tentar usar para spam, o rate limit corta antes de gerar dano.

## Camada 5: Detecção de anomalias

Edge function `monitor-admin-usage` (rodando em cron a cada 15min) que:
- Lê `admin_operations_log` da última hora.
- Compara com baseline (média móvel das últimas 24h).
- Se desvio > 3x, cria notificação para todos os admins com tipo `security_alert`.

Exemplo: se normalmente `scrape-prices` registra 50 ops/hora e de repente registra 5000, dispara alerta. Você descobre o vazamento em 15min em vez de em uma fatura inflada no fim do mês.

## Camada 6: Procedimento de emergência documentado

Criar `docs/security-incident.md` com checklist passo-a-passo para o caso de vazamento:

1. **Imediato (você sozinho)**:
   - Cloud → Edge Functions → desabilitar todas que usam service role (corta o uso da key).
   - Cloud → Users → "Sign out all users" (revoga sessões).
   - Trocar `BROWSERLESS_API_KEY`, `FIRECRAWL_API_KEY` em Cloud → Secrets (você consegue rotacionar essas sozinho, e como a service role vazada poderia ler os outros secrets via edge function, melhor trocar tudo).
2. **Em paralelo (suporte)**:
   - Email para `support@lovable.dev` com assunto "URGENT: service role key compromise — project 667f8a1f-61e4-4274-8da0-fdacd8d61791".
   - Mensagem no Discord oficial canal #support marcando equipe.
3. **Pós-rotação**:
   - Auditar `admin_operations_log` no período entre vazamento e rotação.
   - Revisar `historico_precos`, `notifications`, `messages` por inserções suspeitas.

## Arquivos afetados

| Ação | Arquivo |
|---|---|
| Criar | `supabase/functions/_shared/admin-client.ts` (wrapper auditado) |
| Editar | `supabase/functions/scrape-prices/index.ts`, `scrape-prices-cron/index.ts`, `sync-prices-webhook/index.ts`, `check-reminders/index.ts` (usar wrapper + comentário justificando) |
| Migration | criar tabela `admin_operations_log` + RLS (admin-only SELECT) |
| Migration | criar tabela `rate_limits` + função `check_rate_limit(_key text, _max int, _window_seconds int)` |
| Editar | `supabase/functions/sync-prices-webhook/index.ts` e `scrape-prices/index.ts` — chamar `check_rate_limit` no início |
| Criar | `supabase/functions/monitor-admin-usage/index.ts` + cron job a cada 15min |
| Criar | `docs/security-incident.md` |

## Resultado esperado

- Service role key continua existindo (não dá pra eliminar), mas:
  - Uso é logado e auditável em tabela própria.
  - Anomalias geram alerta em ≤15min.
  - Rate limiting impede abuso volumétrico.
  - Procedimento de emergência permite mitigação imediata sem esperar suporte.
- Custo: zero (tudo dentro do Lovable Cloud atual).
- Trabalho de migração futura para Supabase Connection: desacoplado — se um dia decidir migrar, todas essas camadas continuam funcionando lá também.

