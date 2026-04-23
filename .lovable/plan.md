

# Júlia: priorizar comando "remarcar" sobre dedupe

## Causa raiz

No prompt atual (`camada1`), a regra **DEDUPE OBRIGATÓRIO** (linha 234) é descrita como obrigatória "antes de TODA chamada `create_reminder`, sem exceção". Quando o usuário diz "trocar treino das 11 para 11h15", o modelo:

1. Identifica que vai criar um treino às 11h15
2. Roda o dedupe → encontra o treino das 11h
3. Pergunta a/b/c → ignora que o usuário JÁ disse "trocar" (= substituir)

A regra de **REMARCAR** (linha 239) existe mas perde a disputa porque o modelo entra primeiro no fluxo de criação.

## Mudança (apenas no prompt)

Editar `supabase/functions/assistente-virtual/index.ts`, string `camada1`:

### 1. Mover REMARCAR/CANCELAR para ANTES do DEDUPE e marcar como prioritário

Reordenar para que a primeira regra após "REGRAS PARA FERRAMENTAS" seja:

> **PRIORIDADE MÁXIMA — INTENÇÃO DE REMARCAR/CANCELAR:** Antes de qualquer outra regra, detecte se a mensagem contém verbos de remarcar (`trocar`, `mudar`, `remarcar`, `passar de X pra Y`, `adiar`, `antecipar`, `mover`) ou cancelar (`cancela`, `desmarca`, `apaga`, `remove`). Se sim:
> - É um comando de EDIÇÃO, não de criação. NÃO entre no fluxo de DEDUPE.
> - Chame `list_reminders`, filtre por título + horário antigo, e execute conforme a regra abaixo.
> - "Trocar/mudar X de H1 pra H2" = `delete_reminder` no antigo + `create_reminder` no novo, SEM perguntar a/b/c (o usuário já decidiu substituir).

### 2. Tornar o DEDUPE explicitamente condicional

Mudar o início da regra DEDUPE de "antes de TODA chamada create_reminder, sem exceção" para:

> "DEDUPE OBRIGATÓRIO (apenas quando a intenção é CRIAR um lembrete novo — NÃO se aplica quando o usuário pediu remarcar/trocar/cancelar; nesses casos, siga a regra de PRIORIDADE MÁXIMA acima)."

### 3. Reforçar processamento de múltiplos comandos numa frase

Adicionar à seção MÚLTIPLOS COMPROMISSOS:

> Se a mensagem mistura comandos diferentes (ex.: "trocar treino das 11 para 11h15 E cancelar o das 16"), processe cada um na ordem citada, aplicando as regras corretas: o "trocar" vai pelo fluxo REMARCAR, o "cancelar" pelo fluxo CANCELAR. Confirme tudo numa resposta só ao final.

## Arquivo alterado

- `supabase/functions/assistente-virtual/index.ts` (apenas string `camada1`)

## Resultado esperado

Usuário: *"Trocar treino das 11 para 11h15 e me avisa 15min antes. Cancelar o compromisso das 16."*

Júlia:
```
✅ Pronto!
- Treino remarcado pra **11h15** (aviso às **11h**).
- Compromisso das **16h** cancelado.
```

Sem perguntar "a, b ou c".

## Fora do escopo

- Sem mudar ferramentas, schema, frontend ou outras regras.

