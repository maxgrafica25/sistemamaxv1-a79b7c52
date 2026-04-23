

# Verificação dos 3 cenários (sem mudanças necessárias)

## 1. "Desmarcar o das 16h e remarcar para 17h, me avisando 15min antes" — ✅ vai funcionar

A Júlia já tem as ferramentas e regras pra isso:
- `list_reminders` → encontra o lembrete das 16h.
- `delete_reminder({ id })` → remove o antigo.
- Linha 224 do prompt: *"Para 'me avise X antes de Y' dito de uma vez (...): pule a pergunta, já aplique as regras de título/descrição/remind_at acima."* Ou seja, ela cria o novo às 17h com remind_at = 16h45, title "Teste Sistema 2 às 17h", description "Aviso 15min antes".
- Antes de criar, dispara `check_reminder_conflict` (linha 243), e como o antigo já foi removido, não vai conflitar consigo mesmo.

No print que você mandou, é exatamente o que ela fez ("Vou te avisar... às 16h45 sobre seu Teste Sistema 2 às 17h"). Funcionou.

## 2. "Determinar na mensagem o tempo de antecedência (15min ou outro)" — ✅ vai funcionar automático, sem chips

Linha 224 do prompt cobre **qualquer antecedência dita de uma vez**, não só os valores dos chips:
- "me avise 15min antes do treino das 11h" → cria direto, sem chips.
- "me avise 45min antes" / "2h antes" / "1 dia antes" → mesma coisa, calcula `remind_at = horário − X` e cria.
- Para múltiplos compromissos com antecedência dita na mesma frase (linha 227): processa todos em sequência sem chips.

Os chips só aparecem quando o usuário **não disse** a antecedência. Se você falar o tempo, ela aplica e pronto.

## 3. Chip "15 min antes" para todos os usuários — ✅ confirmado

O botão está em `src/components/assistente/AssistenteMensagem.tsx` linha 97-99, dentro do bloco renderizado sempre que a Júlia emite o marcador `[JULIA_CHIPS:lead_time]`. Não há condicional por usuário, role, ou feature flag — todo usuário autenticado que abrir a Júlia vê os 5 chips na mesma ordem: **Na hora · 15 min antes · 1 hora antes · 3 horas antes · Personalizar**.

## Conclusão

Nada precisa ser alterado. Os três fluxos já estão suportados pelo prompt e pelo frontend atuais.

