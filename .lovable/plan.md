
## Análise

Você quer que a solução já nasça preparada para:
1. **Múltiplos preços por produto** (tiers de quantidade: 1un, 10un, 20un...)
2. **Rodar continuamente na VPS** (não só Firecrawl manual)
3. **Detectar mudanças e alertar** em qualquer tier

A diferença em relação ao plano anterior: em vez de acoplar a detecção ao Firecrawl, vamos modelar o **dado** de forma genérica e deixar o **mecanismo de coleta** plugável (Firecrawl agora, robô Playwright na VPS depois — ambos escrevendo na mesma estrutura).

## Arquitetura proposta

```text
┌─────────────────────────────────────────────────────────┐
│            sites_monitorados (1 produto = 1 linha)      │
│  + metodo_coleta: 'firecrawl' | 'vps_playwright' |      │
│                   'excel' | 'url_simples'                │
│  + config_coleta: jsonb (schema/seletores/headers)      │
└────────────────┬────────────────────────────────────────┘
                 │ 1:N
                 ▼
┌─────────────────────────────────────────────────────────┐
│         site_precos_tiers (N preços por produto)        │
│  quantidade | preco_total | preco_unitario | atualizado │
└────────────────┬────────────────────────────────────────┘
                 │ trigger on UPDATE
                 ▼
┌─────────────────────────────────────────────────────────┐
│   historico_precos_tiers + alertas_precos + sino        │
└─────────────────────────────────────────────────────────┘

         ┌──────────────┐         ┌──────────────┐
         │  Firecrawl   │         │ VPS Worker   │
         │ (agora,      │         │ (futuro,     │
         │  edge func)  │         │  Playwright) │
         └──────┬───────┘         └──────┬───────┘
                │                        │
                └────────┬───────────────┘
                         ▼
               POST /sync-prices-webhook
               (mesmo contrato pros 2)
```

A chave é: **qualquer coletor (Firecrawl hoje, VPS amanhã) chama o mesmo endpoint** com o payload `{ site_id, tiers: [...] }`. O banco e os alertas não sabem nem se importam quem coletou.

## Mudanças

### 1. Migration — modelo de dados genérico
- **`sites_monitorados`**: adicionar `metodo_coleta` (text), `config_coleta` (jsonb), `intervalo_check_horas` (int, default 24)
- **`site_precos_tiers`** (nova): `id, site_id, quantidade, preco_total, preco_unitario, preco_anterior, atualizado_em, ativo`
- **`historico_precos_tiers`** (nova): `id, tier_id, valor_total, valor_unitario, criado_em` — mantém histórico por tier
- **Trigger `handle_tier_price_change`**: ao UPDATE em `site_precos_tiers`, grava histórico, gera alerta + notificação para todos profiles (mesmo padrão do `handle_price_change` atual, mas por tier)

### 2. Conector Firecrawl
Adicionar via `standard_connectors--connect`. Sem custo de chave para você — o conector gerencia.

### 3. Edge function `detect-price-tiers` (descoberta inicial)
- Input: `{ url }`
- Chama Firecrawl com schema JSON pedindo `{ produto, tiers: [{quantidade, preco_total, preco_unitario}] }`
- Retorna prévia para o usuário confirmar antes de salvar

### 4. Edge function `sync-prices-webhook` (contrato unificado)
- Input: `{ site_id, tiers: [{quantidade, preco_total, preco_unitario}], origem: 'firecrawl'|'vps' }`
- Faz upsert por `(site_id, quantidade)` em `site_precos_tiers`
- Trigger do banco cuida dos alertas
- Autenticado por bearer token (mesmo `VPS_WORKER_TOKEN` que já existe)
- **Esse endpoint serve tanto pro Firecrawl agendado quanto pro robô da VPS no futuro** — é o "porto" comum

### 5. Edge function `scheduled-sync-firecrawl` + cron
- Cron diário (pg_cron) percorre `sites_monitorados` onde `metodo_coleta='firecrawl'` e `ativo=true`
- Para cada site: chama Firecrawl → posta em `sync-prices-webhook`
- Quando você ligar a VPS, basta marcar sites como `metodo_coleta='vps_playwright'` e a VPS chama o mesmo webhook

### 6. UI
- **`NovoSiteDialog`**: nova aba "Tabela de preços (auto)" com botão "Detectar tiers", prévia em tabela, salvar
- **`Monitoramento.tsx`**: cards mostram **mini-tabela de tiers** (Qtd | Preço un. | ▲▼ vs anterior) em vez de um preço único; badge indica método de coleta
- Botão "Sincronizar agora" por produto (chama `scheduled-sync-firecrawl` para 1 site só)

## O que a VPS vai precisar fazer no futuro (já documentado no schema)

```text
POST https://<projeto>.supabase.co/functions/v1/sync-prices-webhook
Authorization: Bearer <VPS_WORKER_TOKEN>
Body: {
  "site_id": "uuid",
  "origem": "vps",
  "tiers": [
    { "quantidade": 1,  "preco_total": 56.00,   "preco_unitario": 56.00 },
    { "quantidade": 10, "preco_total": 538.20,  "preco_unitario": 53.82 },
    { "quantidade": 20, "preco_total": 1036.40, "preco_unitario": 51.82 }
  ]
}
```

A VPS lê `config_coleta` do site (que pode conter seletores Playwright, headers, cookies, etc.) e devolve no formato acima. **Zero refatoração no Lovable quando isso for ligado.**

## Aprovação necessária

- Conectar **Firecrawl** (1 clique). É o que faz funcionar agora para sites com JS como o da ANS.

## Limites honestos

- Firecrawl tem custo por scrape (~50 produtos × 1x/dia = ~1500/mês, cabe no plano básico).
- Quando migrar pra VPS, o custo zera — e a estrutura já está pronta.
- Excel continua sendo o caminho ideal pra fornecedores que mandam planilha (caso ATual).
