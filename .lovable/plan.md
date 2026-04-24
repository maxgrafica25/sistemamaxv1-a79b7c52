## Correções aplicadas (Júlia / agenda)

### 1. Agenda só mostra pendentes em consultas genéricas
Nova regra no system prompt (acima da regra de cancelados):
- "Tenho compromisso?", "olhe toda a agenda", "esses são todos?" etc. ⇒ só pendentes.
- Histórico de cancelamentos/remarcações só com palavras explícitas ("cancelado", "deletei"...).

### 2. Apagar em massa usa contagem real e fala "pendentes"
Texto da confirmação ajustado para
"Confirma apagar TODOS os N **compromissos pendentes** acima?"
N = quantidade exata de `list_reminders`, sem contar histórico.

### 3. Guard de ambiguidade no `delete_reminder`
Antes de executar delete:
- se a frase do usuário cita só horário (sem título distintivo) e há 2+ pendentes nesse horário no escopo de data ativo, recusa o delete e devolve `{candidates}` pra Júlia perguntar qual.

## Arquivo
- `supabase/functions/assistente-virtual/index.ts`
- Deploy concluído.
