

# Júlia: bugs sérios na listagem e no fluxo de remarcar

## O que aconteceu (evidência dos logs)

Sessão das 15:59-16:00, pedido: "Alterar treino para 11h e cancelar 16h".

### Bug 1 — Listagem mostra avisos (`remind_at`) como se fossem compromissos

A Júlia exibiu na tela:
```
- 12h00 — Treino (aviso 11h45)
- 13h15 — Treino (aviso 12h00)
- 16h00 — Treino (aviso 13h45)
- 17h00 — Teste Sistema 1
- 17h00 — Teste Sistema 2 (aviso 16h45)
```

Mas o banco tem para 27/04 (em UTC-3):
```
11h00  Treino  (id 82a34daa)  ← aviso 10h45
12h00  Treino  (id 77e2f837)  ← aviso 11h45
13h15  Treino  (id 1cd24fd0)  ← aviso 16h00 (atrasado)
14h00  Teste Sistema 1
14h00  Treino  (id cdf4a8d4)  ← duplicata residual
14h00  Treino  (id 68cb4da0)  ← criado nesta sessão (terceira duplicata!)
16h00  Teste Sistema 2 (96dc0dce)
17h00  Teste Sistema 2 (30482768)
```

A Júlia converteu errado. Mostrou 12h, 13h15, 16h, 17h, 17h — esses são exatamente os horários de **`remind_at`** convertidos pra fuso local, **não os `event_at`**. Então: voltou ao bug antigo de exibir aviso como se fosse compromisso. Pior: incluiu também "(aviso 11h45)" do lado, que é justamente o `event_at` real — ou seja, **inverteu os dois campos na renderização**.

### Bug 2 — Não tem nada às 16h, mas a Júlia "cancelou 16h"

O usuário pediu "cancelar 16h". Os logs mostram que ela tentou apagar `id=491dd819...` (UUID inventado) e `id=f9dd7b43...` (outro UUID inventado). Guard rejeitou os dois — ✅ funcionou. Mas o que tem às 16h *real* (`event_at = 16:00 UTC = 13h local`)? O Treino `82a34daa` (que ela está rotulando errado de "16h"). Como ela exibiu errado, o usuário pediu cancelar baseado no horário errado, e mesmo assim o cancelamento não rodou.

### Bug 3 — Criou DUPLICATA do Treino 11h em vez de remarcar

Apesar do `delete` ter falhado, o `create_reminder` rodou e gerou `68cb4da0` (Treino 14h UTC = 11h local), criando o **terceiro Treino para o mesmo dia 27 às 11h** (já existia `cdf4a8d4` do dia 23 às 16:57 e o novo agora). O bloqueio "REMARCAR atômico" que tínhamos colocado **não disparou**. Vou confirmar abaixo o porquê.

### Bug 4 — Mensagem final mente

Júlia respondeu: "✅ Pronto! Te aviso no dia 27 às 10h45 sobre o Treino das 11h." Como se tudo tivesse dado certo. Mas:
- O Treino antigo (82a34daa, das 11h) NÃO foi cancelado.
- O 16h não foi cancelado (porque não existe).
- Foi criada uma duplicata para 11h.

Resultado real: usuário pensa que está tudo certo, mas tem 2 treinos às 11h e nada foi alterado.

## Causa raiz (3 problemas distintos)

### Causa 1 — Renderização dos campos invertida no prompt
A regra que escrevi antes ("usar `event_at` para exibir") é ambígua e o modelo está pegando `remind_at` por proximidade visual nos JSONs (ele lista campos em ordem `remind_at, event_at` e o modelo pega o primeiro). Precisa ser **explícito + ter exemplos no prompt**.

### Causa 2 — Bloqueio "REMARCAR atômico" não está disparando neste caso
A heurística da sessão anterior só ativava `isRemarcarSession` se a mensagem do usuário batesse com `troca/trocar/remarca/remarcar/muda/mudar de ... para ...`. A frase agora foi **"Alterar treino para 11h e cancelar 16h"** — usa "alterar", verbo que não está no regex. Então:
- `isRemarcarSession = false`
- Bloqueio do `create_reminder` não dispara
- Duplicata é criada

### Causa 3 — Resposta final não confere o que de fato aconteceu
A Júlia gera a resposta otimista mesmo quando algumas tools falharam. Não tem regra "se algum delete falhou, mencione no resumo".

## Correções

### 1. Reescrever regra de exibição de horários (prompt + exemplo)
- Regra dura: "Para exibir, use SEMPRE `event_at`. Para gerar o aviso, use SEMPRE `remind_at`. NUNCA misture os dois. Se em dúvida, prefira `event_at`."
- Adicionar exemplo concreto no prompt mostrando JSON de input → texto de output correto.
- Renomear conceitualmente nas instruções: "horário do compromisso" = `event_at`, "horário do aviso" = `remind_at`. Nunca "horário" sozinho.

### 2. Expandir regex de detecção de "modo remarcar"
- Atual: `troca|trocar|remarca|remarcar|muda|mudar`
- Adicionar: `alterar|altera|mover|mover|antecipar|adiar|passar para|passar pra|ajustar`
- Também: detectar padrão "<verbo> X para Y" com qualquer verbo de modificação.

### 3. Bloqueio mais agressivo de duplicata, independente de "modo remarcar"
- Antes de qualquer `create_reminder`, comparar contra todos os pendentes ativos: mesmo `title` (normalizado, sem acento) E mesmo `event_at` (mesma data + diferença ≤ 30 min) → **bloquear** retornando `{ error: "Já existe '<title>' às <hora>. Cancele o existente primeiro ou confirme que quer mesmo criar duplicado." }` com lista de matches.
- Isso protege todos os cenários, não só "remarcar".

### 4. Resumo final auditado
- Após o loop de tools, no servidor, montar um "resumo do que aconteceu" baseado nas tools que **realmente passaram** (deletes confirmados, creates confirmados) e injetar no contexto antes do modelo gerar a resposta final.
- Regra de prompt: "A resposta final deve refletir EXATAMENTE o resumo de operações abaixo. Não invente sucesso. Se algo falhou, diga que falhou e o que tentar."

### 5. Limpeza dos dados ruins criados nesta sessão
SQL pontual:
- Cancelar `68cb4da0` (Treino 27/04 14h UTC criado às 19:00:43, duplicata da sessão atual) com `cancelled_reason='duplicate_from_failed_reschedule'`.
- Cancelar `cdf4a8d4` (Treino 27/04 14h UTC criado às 16:57, duplicata residual de sessão antiga) com mesma razão.
- Resultado: sobra só `82a34daa` (Treino 27/04 11h, criado durante "alterar 11h15 → 13h" anterior) como o "Treino das 11h" autoritativo.

## Arquivos alterados

- `supabase/functions/assistente-virtual/index.ts`:
  - Prompt: regras de exibição com exemplo, regex expandido, regra de resumo final auditado.
  - `executeTool("create_reminder")`: checagem anti-duplicata por título + `event_at` antes de inserir.
  - Após o loop de tools: gerar bloco "OPERAÇÕES REALIZADAS" e injetar no contexto.
- 1 migration SQL: cancelar `68cb4da0` e `cdf4a8d4`.

## Resultado esperado

Pergunta: "o que tenho para 27?"
Júlia (correto):
```
Pendentes para 27/04/2026:
- 11h00 — Treino (aviso 10h45)
- 12h00 — Treino (aviso 11h45)
- 13h15 — Treino (aviso 16h00, atrasado)
- 14h00 — Teste Sistema 1
- 16h00 — Teste Sistema 2 (aviso 15h45)
- 17h00 — Teste Sistema 2 (aviso 16h45)
```

Pergunta: "Alterar treino para 11h e cancelar 16h"
Júlia: "Não achei nenhum compromisso às 16h no dia 27. Tem Treino às 11h, 12h, 13h15. Qual deles você quer alterar e qual quer cancelar? Confirma os horários certinho."
(Sem inventar deletes. Sem criar duplicata.)

## Fora do escopo

- Sem mudar schema.
- Sem mexer em UI da inbox/auditoria.
- Sem mudar o cron de avisos.

