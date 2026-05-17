## Fase 3 — Assistente Inteligente

Objetivo: enquanto o orçamentista monta o pedido, um painel lateral sugere **acabamentos, mão-de-obra, perguntas e alertas** que ele provavelmente esqueceu — com justificativa visível ("3 últimos orçamentos de lona ≥6m² incluíram bainha + ilhós").

Três camadas combinadas, da mais previsível à mais inteligente:

```text
┌──────────────── Assistente do orçamento ────────────────┐
│ 🔧 Regras (admin)                                       │
│   • Lona ≥ 6m² → sugerir Bainha + Ilhós                 │
│ 📊 Padrão histórico                                     │
│   • 87% dos orçamentos parecidos incluíram "Recorte"    │
│ 🤖 IA (Lovable AI Gateway)                              │
│   • "Cliente é construtora → considerar lona resistente"│
└─────────────────────────────────────────────────────────┘
```

### Sub-fases

**3a — Motor de regras (determinístico)**
- Tabela `quote_suggestion_rules` (admin): condição (mídia, família, área min/max, altura min, tags do cliente) + ação (sugerir acabamento_id, sugerir pergunta_id do checklist, alerta de texto livre, severidade).
- Tela admin "Sugestões" em Cadastros CV (CRUD + drag).
- Painel `QuoteAssistant` no `NewQuoteFormV2` (recolhível, lado direito), avaliação reativa a cada item.
- Cada sugestão tem botões **Aplicar** (adiciona acabamento/pergunta) / **Dispensar** (some por esta sessão).

**3b — Padrão histórico (sem IA externa)**
- Edge function `historical-suggestions`: dado um conjunto de itens em montagem, busca os últimos N orçamentos com perfil similar (mesma mídia + faixa de área), retorna acabamentos com frequência ≥ 60%.
- Cache de 10 min por assinatura (`mídia|faixa_area|familia_dominante`) em tabela `historical_suggestion_cache` para não pesar.
- Exibido como segunda seção do painel com a porcentagem ("inclusos em 9 de 12 orçamentos parecidos").

**3c — IA contextual (Lovable AI Gateway — `google/gemini-2.5-flash`)**
- Edge function `quote-ai-assistant`: recebe snapshot do orçamento (cliente, tags, itens com mídia/área/acabamentos, respostas do checklist) + lista resumida do catálogo (acabamentos ativos, perguntas do checklist).
- Prompt pede até 3 sugestões objetivas em JSON: `{tipo: 'acabamento'|'pergunta'|'alerta', alvo_id?, mensagem, justificativa}`.
- Trigger: botão "Pedir opinião da IA" + auto-run debounced 4s após estabilizar.
- Tratamento dos códigos 429/402 do gateway com toast amigável (mesmo padrão já usado no projeto).

### Schema (3a)

```sql
quote_suggestion_rules
  id               uuid
  nome             text
  ativo            bool
  prioridade       int          -- ordem de exibição
  -- condições
  cond_tipo_midia  text[]       -- vazio = qualquer
  cond_familia     text[]
  cond_area_min    numeric
  cond_area_max    numeric
  cond_altura_min  numeric
  cond_cliente_tag text[]       -- qualquer tag do cliente bate
  cond_sempre      bool
  -- ação
  acao_tipo        text         -- 'sugerir_acabamento'|'sugerir_pergunta'|'alerta'
  acao_acab_id     uuid null
  acao_question_id uuid null
  acao_mensagem    text
  severidade       text         -- 'info'|'aviso'|'critico'
```

RLS: admin all + authenticated select.

Dispensas locais ficam só no estado do componente (não persistem) — evita ruído permanente. Se virar problema, depois pluga em `quote_suggestion_dismissals(quote_id, rule_id)`.

### UI — painel lateral

Drawer recolhível à direita do `NewQuoteFormV2`, largura 360px, sticky no topo. Vazio mostra "Adicione itens para receber sugestões". Cada card tem ícone por camada (🔧/📊/🤖), título, justificativa em texto pequeno, e ações.

### Seed inicial de regras (3a)

| Condição | Ação | Severidade |
|---|---|---|
| midia=lona, area≥6 | sugerir acabamento "Bainha + Ilhós" | aviso |
| midia=adesivo, area≥3 | sugerir pergunta "Remover adesivo atual?" | info |
| altura_min≥3 | alerta "Confirmar logística de altura (andaime/elevatória)" | crítico |
| cliente_tag contém "construtora" | alerta "Validar lona reforçada / 440g" | info |
| midia=chapa, area≥1 | sugerir acabamento "Dupla face" | info |

### Ordem de execução

1. **3a**: migration `quote_suggestion_rules` + RLS + seed → aba admin "Sugestões" → painel `QuoteAssistant` (apenas camada Regras). **Entrega usável sozinha.**
2. **3b**: edge function + cache + segunda seção do painel.
3. **3c**: edge function IA + terceira seção + botão manual + auto-run debounced.

### Decisão pedida

Sigo direto na **3a** (motor de regras + painel) e te entrego pronto para uso, depois discutimos 3b/3c? Ou prefere que eu já planeje as três num único bloco maior?
