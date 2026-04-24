## Problema

Quando o usuário disse **"Deletar todos os compromissos da agenda"**, a Júlia respondeu *"Não consegui identificar exatamente quais lembretes alterar..."* em vez de listar e apagar tudo.

### Causa raiz

No `supabase/functions/assistente-virtual/index.ts` (linha 1442) existe um guard que intercepta qualquer pergunta com as palavras `cancel|delet|apag|remov|exclu` e **força a chamada de `list_cancelled_reminders`** (que lista lembretes JÁ cancelados no passado).

Esse guard foi feito pra perguntas tipo *"foi deletado algum compromisso?"* (consulta de histórico).
Mas ele dispara errado pra **comandos imperativos** como *"deletar todos"*, *"apaga o treino"*, *"cancela o dentista"* — que são ordens pra agir, não perguntas sobre o passado.

Resultado: o modelo recebe uma lista de cancelados (vazia ou irrelevante), fica confuso, mistura com lembretes pendentes e responde pedindo esclarecimento em vez de executar.

## Correção

### 1. Refinar o guard de cancelados (linhas 1440-1464)

Distinguir **consulta de histórico** vs **comando de ação**:

- **Consulta** (dispara guard → `list_cancelled_reminders`): frases interrogativas ou no pretérito sobre o que já foi cancelado.
  Ex.: *"foi cancelado algo?"*, *"deletei alguma coisa?"*, *"o que aconteceu com X?"*, *"algum compromisso foi removido?"*

- **Comando** (NÃO dispara guard → fluxo normal de `list_reminders` + `delete_reminder`): verbo no infinitivo/imperativo pedindo pra agir agora.
  Ex.: *"deletar todos"*, *"apaga o treino"*, *"cancela o dentista das 14h"*, *"remove tudo"*, *"exclui X"*

Heurística: se a frase começa (ou é dominada) por verbo imperativo/infinitivo de ação (`delet(ar|a|e)`, `apag(ar|a|ue)`, `cancel(ar|a|e)`, `remov(er|e|a)`, `exclu(ir|i|a)`) **sem** palavras interrogativas (`foi`, `algum`, `alguma`, `algo`, `?`, `que aconteceu`, `tinha`, `deletei`, `cancelei`, `apaguei`), tratar como comando — pular o guard.

### 2. Reforçar regra de "apagar todos" no prompt (linha 317)

Trocar a frase atual por algo mais explícito e em destaque:

> **APAGAR EM MASSA (REGRA INVIOLÁVEL)**: se o usuário disser *"apaga/deleta/cancela TODOS"*, *"limpa a agenda"*, *"remove tudo"* ou variações sem citar item específico:
> 1. Chame `list_reminders` com janela ampla (próximos 90 dias).
> 2. Se vazio: responda *"Sua agenda já está vazia."*
> 3. Se 1 item: chame `delete_reminder` direto, confirme.
> 4. Se 2+ itens: liste TODOS em bullets e pergunte *"Confirma apagar TODOS os N compromissos acima? (responda SIM pra apagar tudo, ou cite quais manter)"*. Aguarde resposta. Se "sim/confirma/pode": chame `delete_reminder` em sequência pra cada id e confirme no fim *"Pronto, apaguei os N compromissos."*
> Nunca responda *"não consegui identificar quais lembretes alterar"* — você TEM acesso, é só listar.

### 3. Redeploy

Deploy `assistente-virtual` e validar com:
- *"Deletar todos os compromissos da agenda"* → deve listar + pedir confirmação + apagar.
- *"Algum compromisso foi cancelado?"* → ainda deve cair no guard antigo e chamar `list_cancelled_reminders`.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts` (regex do guard + texto do prompt)
