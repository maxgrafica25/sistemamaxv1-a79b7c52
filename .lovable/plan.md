# Júlia: corrigir criação dos lembretes de 27/04 e parâmetro do filtro de data

## O que aconteceu de verdade

Não foi a busca que falhou. Foi a criação que **não salvou os lembretes do dia 27**.

Olhando o banco, os únicos lembretes recentes são:
- `Festa de aniversário Lilinda` — 24/04 19h
- `Dentista` — 30/04 17h

Não existe nenhum registro para 27/04. Por isso, quando você perguntou “quais meus compromissos dia 27?”, ela respondeu **“Nada agendado para 27/04/2026”** — está tecnicamente correta, o problema é que os create nunca chegaram a acontecer.

## Causa raiz nos logs

### Bug 1: `check_reminder_conflict` está recebendo horário no fuso errado
Nos logs vejo:
```
check_reminder_conflict args → {"remind_at":"2026-04-27T11:00:00-03:00"}
check_reminder_conflict args → {"remind_at":"2026-04-30T17:00:00-03:00"}
```

O modelo está mandando horário **local com offset -03:00**, mas a tool `check_reminder_conflict` ainda usa o schema antigo que espera **ISO UTC** (`event_at`). Resultado:
- Para o Dentista (30/04 17h local), o servidor entendeu certo por coincidência.
- Para os do dia 27, o conflict-check pode ter retornado coisa estranha e o modelo desistiu silenciosamente de chamar `create_reminder`.

Repare: nos logs **só aparece um `create_reminder` para 27/04** (o de 11h, que nem aparece no banco), e nenhum para os outros horários que você criou. Os create simplesmente nunca foram emitidos pelo modelo após o conflict-check confuso.

### Bug 2: `list_reminders` está sendo chamado com `from1_date` (typo)
```
tool list_reminders args → {"from1_date":"2026-04-27","to_date":"2026-04-27"}
tool list_reminders args → {"from1_date":"2026-04-01","to_date":"2026-04-30"}
```

O parâmetro correto é `from_date`, mas o modelo mandou `from1_date` em todas as chamadas. Isso significa que o schema que registramos no `tools` array tem o nome errado — é uma colisão / typo no próprio servidor (o modelo só repete o nome que está exposto no schema).

Como o servidor faz `args.from_date`, ele recebe `undefined`, ignora o filtro de data e cai no caminho “lista tudo”. Por sorte, nesse caso o resultado coincidiu (lista vinda completa, sem nada do dia 27), mas é um bug latente.

### Bug 3 (consequência): mesmo o `create_reminder` que foi tentado para 27/04 11h não persistiu
Vejo `check_reminder_conflict` para 27/04 11h às 22:24:57, mas o `create_reminder` correspondente nunca aparece nos logs. Provavelmente o modelo recebeu retorno de conflito malformado e cancelou a criação.

## O que vou ajustar

### 1. Corrigir o typo `from1_date` → `from_date` no schema da tool `list_reminders`
Em `supabase/functions/assistente-virtual/index.ts`, dentro do array `tools`, o parâmetro do `list_reminders` está declarado como `from1_date`. Renomear para `from_date`. Manter `to_date`.

### 2. Migrar `check_reminder_conflict` para o mesmo padrão das outras tools
Hoje `create_reminder` aceita `event_local` e `remind_local` (string `YYYY-MM-DDTHH:mm` em hora Brasil) e o servidor anexa `-03:00`. Mas `check_reminder_conflict` ainda exige `remind_at` em formato ISO completo.

Vou:
- adicionar `remind_local` ao schema do `check_reminder_conflict`
- aceitar tanto `remind_local` (preferencial) quanto `remind_at` (legado)
- converter internamente com o mesmo `localBRtoISO` usado no `create_reminder`

Resultado: o modelo não precisa mais lidar com fuso, igual já faz no create.

### 3. Atualizar o prompt para refletir os nomes corretos
Garantir que a documentação inline da Júlia mencione:
- `from_date` / `to_date` (sem o `1`)
- `remind_local` no `check_reminder_conflict`
- nunca tente montar ISO com offset manualmente

### 4. Aceitar “fallback de typo” por segurança
Para o caso de o modelo continuar mandando `from1_date` (cache de prompt), o servidor lê `args.from_date ?? args.from1_date`. Mesma coisa para `to_date`. Isso evita regressão imediata enquanto o novo schema propaga.

## Arquivo a alterar

- `supabase/functions/assistente-virtual/index.ts`

## Resultado esperado

Refazendo o teste:
1. Criar 3 compromissos para 27/04 → todos passam pelo `check_reminder_conflict` corretamente, todos chegam ao `create_reminder`, todos persistem no banco.
2. “quais meus compromissos dia 27?” → `list_reminders` é chamada com `from_date=2026-04-27&to_date=2026-04-27`, servidor filtra de verdade, retorna os 3.
3. “altera 13h para 13h30 e cancela 14h” → como o `lastPendingList` agora está populado corretamente, o resolver determinístico server-side encontra os UUIDs e executa.

## Fora do escopo

- Sem mudança de schema do banco
- Sem migration
- Sem mexer no frontend
- Sem trocar modelo
