

# Monitoramento: 4 melhorias + explicação do sistema de alertas atual

## Como funciona o sistema de alertas hoje (resposta à pergunta da melhoria #3)

Já existe um pipeline automático no banco — toda alteração de preço é detectada por **triggers do Postgres**, sem precisar de código no front:

1. **`handle_price_change`** dispara em `UPDATE` de `sites_monitorados` quando `preco_atual` muda. Insere histórico em `historico_precos` e, **se o preço caiu**, cria registro em `alertas_precos` (prioridade `alta` se queda ≥10%, `baixa` caso contrário) + uma `notification` no sino para cada usuário.
2. **`handle_tier_price_change`** faz o mesmo para cada tier individual em `site_precos_tiers`: salva em `historico_precos_tiers` e gera alerta + notificação por tier alterado, com a quantidade no texto.

Ou seja: a edge function `scrape-prices` apenas faz `INSERT/UPDATE` nos tiers; **histórico e alertas já são gerados automaticamente** pelos triggers. A aba "Alertas" do `Monitoramento.tsx` consome `alertas_precos` em realtime.

**O que falta hoje:**
- Os triggers só registram **quedas**. Subidas não geram alerta (vou manter assim — é o comportamento desejado para "oportunidade").
- Os alertas atuais não trazem **% de variação estruturado** — só um texto. Vou adicionar `variacao_pct` como coluna nova.
- Não existe **cron** que dispare a sincronização automática diária.
- A tabela `site_precos_historico` que você pediu já existe com nome diferente (`historico_precos_tiers`). Vou reaproveitá-la em vez de criar duplicata.

---

## 1) Dropdown de categorias no modal "Novo Site"

Em `src/components/monitoramento/NovoSiteDialog.tsx`:

- Trocar o `<Input>` de Categoria por um `<Select>` populado via `supabase.from("sites_monitorados").select("categoria")` (distinct client-side, lowercase).
- Adicionar opção fixa **"+ Nova categoria…"** no final. Ao escolher, troca por um `<Input>` inline com botão "Voltar para lista".
- Receber `categoriasExistentes: string[]` por prop (passar do `Monitoramento.tsx`, que já calcula `categorias`) para evitar nova query.
- Validação continua igual; ao salvar usa `.toLowerCase().trim()`.

## 2) Tag "Faixa não disponível" no comparativo

Hoje a aba Comparativo mostra **um card por fornecedor** com a lista própria de tiers — não há uma matriz qty×fornecedor. Para tornar a falta de faixa visível sem quebrar o layout existente:

- Calcular dentro de `gruposComparativoPorCategoria` o **conjunto-união de quantidades** entre todos os fornecedores de cada produto canônico (mesma `key` de produto: `cat:<id>` ou `name:<nome>`).
- No render dos tiers de cada card, percorrer a lista união em vez de apenas `mergedTiers`. Para quantidades que o fornecedor **não cobre**, renderizar uma linha com badge cinza:
  ```
  {qty}un  ·  [Faixa não disponível]   (badge variant="secondary" + texto muted)
  ```
- Linha mantém a mesma altura (`px-2 py-1.5 text-xs`) para não quebrar grid.
- Adicionar tooltip: "Este fornecedor não oferece esta quantidade. Quantidades disponíveis: 1.000, 5.000, …".

## 3) Cron diário de varredura + alertas com % variação

### Schema (migration)

Adicionar colunas calculadas em `alertas_precos` para o front exibir % sem reparsear texto:
```sql
ALTER TABLE public.alertas_precos
  ADD COLUMN IF NOT EXISTS variacao_pct numeric,
  ADD COLUMN IF NOT EXISTS quantidade integer,
  ADD COLUMN IF NOT EXISTS fornecedor_nome text,
  ADD COLUMN IF NOT EXISTS produto_nome text;
```

Atualizar `handle_tier_price_change` para popular essas colunas (trivial, já tem `v_pct`, `v_site` e `NEW.quantidade` em escopo). Atualizar `handle_price_change` para popular `produto_nome`/`fornecedor_nome` (sem `quantidade`).

### Edge function nova: `scrape-prices-cron`

Em `supabase/functions/scrape-prices-cron/index.ts`:
- Service-role client.
- Carrega `sites_monitorados` onde `ativo = true`.
- Itera em série (com `await` entre cada) chamando a função existente `scrape-prices` via `supabase.functions.invoke("scrape-prices", { body: { site_id } })` — reaproveita 100% da lógica atual e já dispara os triggers de alerta automaticamente.
- Logga sumário final (`{ total, ok, fail }`).
- Sem CORS (não é chamada do browser), `verify_jwt = false` no `supabase/config.toml`.

### Cron diário

Habilitar `pg_cron` + `pg_net` e agendar via **insert tool** (NÃO migration, contém URL+anon-key específicos):
```sql
SELECT cron.schedule(
  'scrape-prices-daily',
  '0 6 * * *',            -- 06:00 UTC = 03:00 BRT
  $$ SELECT net.http_post(
       url:='https://nxkmxslugblhsyohrrvm.supabase.co/functions/v1/scrape-prices-cron',
       headers:='{"Content-Type":"application/json","Authorization":"Bearer <ANON_KEY>"}'::jsonb,
       body:='{}'::jsonb
     ); $$
);
```

### Front

Aba **Alertas** em `Monitoramento.tsx`: usar `variacao_pct` (quando presente) para mostrar badge "−12,4%" ao lado da seta, e expor `quantidade`/`fornecedor_nome` em colunas dedicadas. Texto antigo cai no fallback.

## 4) Card "Economia Potencial" abaixo do comparativo

Logo abaixo da grade de cards de cada categoria (dentro do `.map(([cat, compGroups]) => ...)`), inserir um `<Card>` por categoria com o cálculo:

- Para a `qtdAlvo` atual (quando ≠ 0), pegar entre todos os `compGroups` da categoria o `tier` aplicável (`getTierForQty`) por fornecedor, então `min`/`max` de `preco_total`.
- Se houver pelo menos 2 fornecedores com tier para a quantidade:
  ```
  💡 Economia Potencial — {qtdAlvo} un
  Escolhendo {fornecedorMin} em vez de {fornecedorMax}, você economiza
  R$ {max-min} ({((max-min)/max*100).toFixed(1)}%).
  ```
- Quando `qtdAlvo === 0`: mostra texto "Selecione uma quantidade no filtro acima para ver a economia potencial."
- Estilo: borda esquerda verde (`hsl(var(--success))`), ícone `Sparkles`.

---

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/monitoramento/NovoSiteDialog.tsx` (Select + opção "Nova categoria") |
| Editar | `src/pages/Monitoramento.tsx` (passar `categorias` ao dialog; união de qtds no comparativo + linhas "Faixa não disponível"; card Economia Potencial; usar `variacao_pct` na aba Alertas) |
| Criar | `supabase/functions/scrape-prices-cron/index.ts` (orquestrador diário) |
| Migration | `ALTER TABLE alertas_precos` (4 colunas) + atualizar `handle_price_change` e `handle_tier_price_change` para preenchê-las |
| Insert SQL | habilitar `pg_cron`/`pg_net` + `cron.schedule('scrape-prices-daily', ...)` |
| Editar | `supabase/config.toml` (registrar `scrape-prices-cron` com `verify_jwt = false`) |

## Resultado esperado

- Modal "Novo Site": dropdown evita variantes "panfleto"/"Panfleto"/" panfleto ".
- Comparativo: cada card de fornecedor mostra todas as faixas do produto, com tag cinza onde aquele fornecedor não cobre.
- Todo dia às 03:00 BRT a varredura roda sozinha; quedas geram histórico (`historico_precos_tiers` — já existente) + alerta com `variacao_pct` estruturado.
- Aba Comparativo ganha card verde mostrando "economize R$ X (Y%) escolhendo {forn} em vez de {forn}" para a quantidade selecionada.

