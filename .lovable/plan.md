## Objetivo

Reduzir o tempo de resposta da Júlia (hoje 3–13s) para ~1–3s em perguntas de agenda, sem usar nenhum modelo pago. Tudo continua no **Lovable AI Gateway** (gratuito).

## Mudanças

### 1. Trocar o modelo para Gemini 3 Flash Preview (gratuito)
Em `supabase/functions/assistente-virtual/index.ts`, linhas 1390–1391:
- `google/gemini-2.5-flash` → `google/gemini-3-flash-preview`

É o mesmo gateway gratuito, da família Gemini Flash mais nova. Costuma responder mais rápido que o 2.5 Flash mantendo boa qualidade pra tool-calling.

### 2. Carregamento de contexto sob demanda (intent-based)
Hoje, **toda** pergunta carrega 10 tabelas em paralelo (base de conhecimento, equipamentos, consumíveis, 500 leituras de impressora, preços, categorias, tiers, papéis, configurações globais, Google Calendar). Isso pesa em tokens enviados ao modelo.

Vou classificar a intenção logo no início:
```ts
const isAgendaOnly = /\b(lembrete|agenda|compromisso|avis(ar|e|o)|amanh[ãa]|hoje|ontem|dia \d|às \d|cancela|remarca|treino|dentista|reuni[ãa]o)\b/i
  .test(pergunta);
```

Se `isAgendaOnly` for true:
- **Pula** o fetch de `printer_readings`, `equipment_consumables`, `printing_price_items`, `printer_categories`, `markup_tiers`, `papers`.
- Mantém apenas: `base_conhecimento`, `equipments` (leve, usado em alguns lembretes), `global_settings`, `user_google_tokens`.
- Usa um **prompt de sistema enxuto** (versão curta, só com regras de agenda/lembretes/Google Calendar), reduzindo drasticamente os tokens enviados.

Se a pergunta for de produção/preços/equipamento, mantém o comportamento atual (prompt completo + todas as tabelas).

### 3. Reduzir teto de iterações da tool-loop
Linha 1415: `for (let iter = 0; iter < 6; iter++)` → `iter < 4`. Operações de agenda raramente passam de 2–3 iterações; o limite alto só penaliza casos onde o modelo loopa.

### 4. Backoff de retry mais curto
Linha 1409: `600ms / 1500ms` → `300ms / 800ms`. Em 503 transitório do gateway, recupera mais rápido.

### 5. Reduzir limite de leituras de impressora
Quando o modo "completo" rodar, baixar `limit(500)` → `limit(100)` em `printer_readings`. As últimas 100 leituras já cobrem todos os cálculos de "impressões desde a última troca de toner".

## Detalhes técnicos

- Arquivo único alterado: `supabase/functions/assistente-virtual/index.ts`.
- Sem mudanças de schema, sem migrations.
- Sem mudanças no front-end — UX idêntica, só mais rápido.
- Modelo continua no gateway gratuito (Gemini), zero custo de API externa.
- Anti-alucinação implementada na rodada anterior continua ativa.
- Deploy automático do edge function ao salvar.

## Fora de escopo

- Streaming de tokens (mudaria o front também; podemos fazer depois se quiser ganho percebido extra).
- Cache de contexto entre turnos (mais complexo, fica pra v2 se necessário).

## Resultado esperado

- Perguntas de agenda ("mostra meus compromissos", "cria lembrete X às Y"): **~1–3s** (hoje 3–8s).
- Perguntas de produção/preços: **~2–5s** (hoje 5–13s) — ganho menor, vem só do modelo novo + menos iterações.

Aprova?
