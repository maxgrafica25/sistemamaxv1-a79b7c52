
## Ajustes ao plano anterior

Dois pontos do feedback mudam a abordagem:

### 1. Fornecedor automático
Ao colar a URL, o `detect-price-tiers` (Firecrawl) já retorna `fornecedor` (extraído da página). Hoje o `NovoSiteDialog` não usa esse campo automaticamente — vou:
- Auto-preencher `fornecedor_nome` com o valor retornado
- Se vazio, fallback para o **domínio da URL** (ex: `ans.com.br` → "ANS")
- Campo continua editável caso o usuário queira ajustar

### 2. Atualização sob demanda + histórico
Remover a lógica de "queda nos últimos 7 dias" e o cron diário. Em vez disso:
- **Botão "Atualizar todos"** no topo da página Monitoramento → varre todos os sites ativos via Firecrawl
- **Botão "Atualizar"** por card (já existe parcialmente) → atualiza só aquele
- Cada atualização gera registro em `historico_precos_tiers` (já existe)
- Ranking de oportunidades passa a usar **comparação vs último valor histórico de cada tier** (não janela de 7d)

## Mudanças

### Frontend

**`src/components/monitoramento/NovoSiteDialog.tsx`** (aba "Tabela auto"):
- Após `detect-price-tiers` retornar, setar `fornecedor` automaticamente
- Helper `extractDomainName(url)` como fallback
- Mostrar campo já preenchido (editável) com label "Fornecedor (detectado)"

**`src/pages/Monitoramento.tsx`**:
- Remover `useEffect` de auto-sync diário (se houver)
- Manter botão "Sincronizar todos" no topo (chama `scheduled-sync-firecrawl` sem `site_id`)
- Manter botão "Sync" por card
- **Score de oportunidade** recalculado:
  ```text
  Score = (queda_vs_ultimo_historico × 0.5)
        + (sweet_spot_pct × 0.3)
        + (vantagem_vs_concorrente_pct × 0.2)
  ```
  Onde `queda_vs_ultimo_historico` compara `preco_total` atual com o último registro em `historico_precos_tiers` para aquele tier.

### Backend

**`supabase/functions/scheduled-sync-firecrawl/index.ts`**:
- Quando chamado **sem** `site_id` (varredura geral), **ignorar** `intervalo_check_horas` (era o gate do cron). Sempre que o usuário clica "Atualizar todos", roda tudo.
- Manter respeito a `ativo = true`

**Cron job** (se foi criado):
- **Remover** o agendamento `pg_cron` diário. Sistema passa a ser 100% on-demand.

### Restante do plano anterior (mantém)
Tudo do plano de "5 melhores oportunidades / sweet spot / preço por quantidade / mínimo histórico / margem de revenda" segue válido — só muda a fonte do "queda recente" (último histórico em vez de 7d) e a forma de disparar (botão em vez de cron).

## Diagrama atualizado

```text
[Cola URL] ──► detect-price-tiers
                 │
                 ▼
   { produto, fornecedor, tiers }  ← fornecedor auto-preenchido
                 │
                 ▼
            [Salvar]
                 │
                 ▼
    sites_monitorados + tiers iniciais
                 
[Botão "Atualizar todos"] ──► scheduled-sync-firecrawl (sem site_id)
                                │
                                ▼
                  Para cada site ativo: Firecrawl
                                │
                                ▼
                  sync-prices-webhook → upsert tiers
                                │
                                ▼
                  trigger handle_tier_price_change
                                │
                                ▼
                  historico_precos_tiers + alertas + sino
```

## Limitação honesta

- Detecção do nome do fornecedor depende do Firecrawl achar na página. Se não achar, usa o domínio (sempre funciona).
- Sem cron, alertas só aparecem quando você clicar "Atualizar". É o comportamento que você pediu.
