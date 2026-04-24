## Problema

Nos logs, dois turnos vieram com `operations:[]` (a Júlia respondeu **sem chamar nenhuma ferramenta**):

1. *"Algum compromisso foi cancelado?"* → respondeu "Nada cancelado para hoje" (chute)
2. *"Algum compromisso foi deletado de toda agenda?"* → respondeu "Nada agendado para 24/04/2026" (errado: confundiu "deletado" com "agendado" e ignorou "toda agenda")

A ferramenta `list_cancelled_reminders` já existe no backend, mas o prompt só a aciona como *fallback* dentro da regra "consulta histórica" (linha 258-268). Quando o usuário faz uma pergunta direta tipo "algo cancelado?" / "algo foi deletado?", o modelo não reconhece como gatilho e responde no chute.

Também faltam dois comportamentos:
- Tratar **"deletado" como sinônimo de "cancelado"** (no app só existe soft-delete = cancelamento).
- Quando o usuário diz **"toda a agenda"** / "qualquer dia", não filtrar por dia — buscar uma janela ampla (ex.: últimos 30 dias + próximos 90).

## Solução

### 1. `supabase/functions/assistente-virtual/index.ts` — prompt da Júlia

Adicionar uma regra de **PRIORIDADE MÁXIMA** sobre consultas de cancelados/deletados, acima da regra atual de "consulta histórica":

> **CONSULTA DE CANCELADOS/DELETADOS (REGRA INVIOLÁVEL):** se a pergunta do usuário contém qualquer das palavras **cancelado, cancelei, cancelamento, deletado, deletei, apagado, apaguei, removido, excluído** (com ou sem filtro de data), você é OBRIGADA a chamar `list_cancelled_reminders` ANTES de responder. Nunca responda "nada cancelado" / "nada deletado" sem ter chamado essa ferramenta no turno atual.
>
> - **Escopo da janela `from`/`to`:**
>   - Se o usuário citou um dia específico → janela = aquele dia inteiro em America/Sao_Paulo.
>   - Se disse **"toda a agenda" / "qualquer dia" / "alguma vez" / sem data** → janela ampla: `from` = 30 dias atrás, `to` = 90 dias à frente (ISO com offset −03:00).
> - **"Deletado" == "cancelado"** neste app (não existe hard-delete pelo usuário). Trate as duas palavras como sinônimos.
> - Após chamar a ferramenta, aplique o FILTRO POR INTENÇÃO já existente (linhas 264-266): mostrar só `cancelled_reason='user_cancelled'` quando a pergunta é especificamente sobre cancelamento/deleção.
> - Se vier vazio: responda "Nada cancelado em <período citado>." (use "em toda a agenda" quando a janela foi a ampla).

### 2. Backend — defesa contra modelo preguiçoso

No tratamento da resposta final (`supabase/functions/assistente-virtual/index.ts`), adicionar verificação: se a pergunta do usuário do turno atual casa com regex `/cancel|delet|apag|remov|excluí/i` E `operations` não contém `list_cancelled_reminders`, injetar uma mensagem `system` extra forçando re-execução com a tool antes de finalizar (mesmo padrão já usado em outras regras invioláveis do arquivo).

### 3. Logging

Já existe `turn_summary`. Adicionar no log o array `tools_called: string[]` para facilitar auditoria futura ("a Júlia chamou list_cancelled_reminders ou não?").

## Como testar

Após o deploy:
1. *"Algum compromisso foi cancelado hoje?"* → deve chamar `list_cancelled_reminders` com janela do dia.
2. *"Algum compromisso foi deletado de toda agenda?"* → deve chamar `list_cancelled_reminders` com janela ampla (−30d / +90d) e listar o "Dentista 14h" cancelado às 11:39.
3. *"Deletei alguma coisa essa semana?"* → janela = semana atual.

Nos logs, conferir `turn_summary.tools_called` contendo `"list_cancelled_reminders"`.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts` (prompt + guard de re-execução + log).

Sem migration, sem mudança de schema, sem mudança no frontend.
