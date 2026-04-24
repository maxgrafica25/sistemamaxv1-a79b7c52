## Mudanças aprovadas — implementar ao sair do modo plano

### 1. `supabase/functions/assistente-virtual/index.ts`

**A) Anti-alucinação de confirmação**
- Acumular durante o loop de tools:
  - `createdInThisTurn: Array<{title, remind_at, id}>`
  - `failedInThisTurn: Array<{title, reason}>`
- Antes da resposta final, injetar mensagem `system` obrigatória:
  > "REGRAS ESTRITAS DE CONFIRMAÇÃO: só use ✅ para itens em CRIADOS_NESTE_TURNO. Para itens em FALHAS_NESTE_TURNO, use ❌ e diga o motivo. Não invente confirmações."
- Incluir os dois arrays serializados como JSON nessa mensagem.

**B) Sanitização de datas em `list_reminders`**
- Aplicar `?.slice(0, 10)` em `from_date` / `to_date` antes do filtro, garantindo formato `YYYY-MM-DD`.
- Converter para limites do dia em UTC (`T00:00:00Z` / `T23:59:59Z`) antes de comparar com `remind_at`.

**C) Logging estruturado**
- Para cada iteração de tool: `console.log(JSON.stringify({type:'tool_call', name, args}))`.
- Para cada resultado: `console.log(JSON.stringify({type:'tool_result', name, ok, error?, id?}))`.
- Ao final do turno: `console.log(JSON.stringify({type:'turn_summary', created: createdInThisTurn, failed: failedInThisTurn}))`.

### 2. Migration — limpar duplicatas de teste
SQL:
```sql
UPDATE public.reminders
SET cancelled_at = now(), cancelled_reason = 'user_cancelled'
WHERE title ILIKE 'Academia'
  AND event_at >= '2026-04-27T00:00:00-03:00'
  AND event_at <  '2026-04-28T00:00:00-03:00'
  AND cancelled_at IS NULL;
```

### 3. Redeploy
Automático após salvar a função.

## Como testar
1. "Júlia, crie Treino dia 27 às 11h e Dentista dia 27 às 14h."
2. "Quais compromissos tenho dia 27?"
3. Conferir nos logs o `turn_summary` para validar criados vs. confirmados.
