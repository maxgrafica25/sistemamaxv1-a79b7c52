

# Júlia: lembrete com antecedência — preservar contexto + esclarecer Google Calendar

## Diagnóstico do que aconteceu

No print, você disse "tenho dentista amanhã às 14h" → Júlia criou às 14h (correto pela regra atual). Você corrigiu pedindo aviso antes → ela criou um **segundo lembrete às 12h com título "Dentista"**, sem mencionar que o compromisso real é às 14h. Resultado: dois lembretes "Dentista" idênticos no título, e o das 12h não te diz nada útil quando tocar.

Causa: a regra atual no prompt (`camada1`, linha 201) manda "calcule remind_at = Y - X e grave esse horário", mas **não manda preservar o horário e local do compromisso no título/descrição**. O `title` vira só "Dentista" e a `description` fica vazia (confirmado nos logs: `"description":null`).

## Sobre Google Calendar

**Não.** Os lembretes são salvos apenas na tabela `reminders` do banco interno e disparam via cron `check-reminders` → `notifications` → sininho do `NotificationBell` em tempo real. Não há integração com Google Calendar implementada. Se você quiser isso, é uma fase à parte (OAuth Google + Calendar API) — posso planejar separadamente se confirmar.

## Correção proposta (escopo mínimo)

**Arquivo único**: `supabase/functions/assistente-virtual/index.ts`, bloco `camada1` (linhas ~190-204). Reescrever as regras de `create_reminder` para:

1. **Quando o usuário pedir "me avise X antes de Y"**:
   - `remind_at` = Y − X (já era assim).
   - `title` = inclui o horário do compromisso real, ex.: `"Dentista às 14h"`.
   - `description` = preenche com contexto: `"Aviso 2h antes do compromisso das 14h."`.
   - Confirmação ao usuário deve dizer: *"Vou te avisar amanhã às 12h sobre o seu dentista das 14h."*

2. **Antes de criar um novo lembrete sobre o mesmo assunto, chamar `list_reminders`** para detectar duplicata. Se houver lembrete pendente com título parecido, perguntar: *"Já existe um lembrete 'Dentista' para 14h. Quer que eu (a) substitua pelo aviso das 12h ou (b) adicione um segundo lembrete às 12h mantendo o das 14h?"*

3. **Limpeza opcional dos 3 lembretes "Dentista" duplicados** que ficaram do teste — a Júlia mesma resolve se você pedir *"apaga todos os lembretes do dentista"* (já funciona via `list_reminders` + `delete_reminder` em loop).

## Detalhes técnicos

- Sem mudança de schema, RLS, `reminders-api`, cron ou frontend.
- Mudança puramente no system prompt (Camada 1) — risco mínimo.
- O modelo (Gemini) já segue regras explícitas do prompt; basta deixar as novas regras inequívocas.

Diff conceitual (linhas 198-204):

```text
REGRAS PARA FERRAMENTAS:
- Antes de criar, se o pedido for sobre um assunto recorrente (dentista,
  reunião, etc.), chame list_reminders e verifique duplicatas; se houver,
  pergunte ao usuário se quer substituir ou adicionar.
- Se faltar data/hora, NÃO invente — pergunte.
- Para "me avise X antes de Y":
    • remind_at = Y - X
    • title DEVE incluir o horário do compromisso real
      (ex.: "Dentista às 14h", não só "Dentista")
    • description DEVE registrar o contexto
      (ex.: "Aviso 2h antes do compromisso das 14h.")
- Confirme em pt-BR mencionando AMBOS os horários: o do aviso e o do
  compromisso (ex.: "Pronto! Vou te avisar amanhã às 12h sobre seu
  dentista das 14h.").
- Para excluir, se houver mais de um lembrete que casa, peça confirmação
  listando os candidatos com horário e descrição.
- Para "quais meus lembretes", chame list_reminders e formate em lista
  curta incluindo título e descrição quando houver.
```

## Validação após deploy

1. *"Apaga todos meus lembretes do dentista"* → Júlia lista e remove os 3 duplicados.
2. *"Tenho dentista amanhã às 14h, me avise 2h antes"* → cria **1 lembrete** com `title="Dentista às 14h"`, `description="Aviso 2h antes do compromisso das 14h."`, `remind_at=23/04 12:00`. Resposta confirma os dois horários.
3. *"Tenho dentista amanhã às 14h, me avise 2h antes"* (de novo) → Júlia detecta duplicata e pergunta antes de criar.
4. Quando o sininho tocar às 12h, o título mostrado vai dizer "Dentista às 14h" — você sabe na hora qual é o compromisso.

## Fora deste escopo

- Integração com Google Calendar (precisa OAuth Google + Calendar API + UI de conexão por usuário) — posso planejar como Fase 2.5 se confirmar interesse.
- Edição de lembrete in-place (hoje só cria/lista/exclui) — adicionar `update_reminder` é trivial mas só se for prioridade.

