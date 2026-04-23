
# O que ela não conseguiu fazer

Ela não conseguiu transformar a sua frase:

- “alterar 13h para 13h30”
- “cancelar 14h”

nos **UUIDs exatos** dos lembretes da lista de 27/04.

## O que aconteceu de verdade

Pelos logs, a Júlia tentou chamar:

```text
delete_reminder { id: "4e8a4a2b-de94-436f-80d5-171b3e1b7829", reason: "rescheduled" }
```

e o servidor recusou com:

```text
uuid_not_in_session
```

Ou seja:
- ela **não escolheu o id certo** da lista atual;
- usou um UUID que **não estava entre os lembretes válidos daquela consulta**;
- por segurança, o servidor bloqueou a exclusão.

## Em termos simples

Ela entendeu a intenção geral:
- trocar o compromisso das 13h
- cancelar o das 14h

Mas **não conseguiu casar isso automaticamente com os dois registros exatos** que vieram na listagem.

Hoje o fluxo funciona assim:
1. a lista mostra os lembretes corretos;
2. o modelo precisa escolher, sozinho, qual item da lista corresponde a “13h” e “14h”;
3. se ele errar o UUID, o servidor barra.

Então o que falhou não foi “entender português” no sentido amplo — foi a etapa de **resolver a referência textual para o identificador exato**.

## Por que ela respondeu “não consegui identificar exatamente quais lembretes alterar”

Porque esse é justamente o fallback do servidor quando:
- houve tentativa de `delete_reminder`,
- o id usado não era válido para a sessão atual,
- e nenhum delete chegou a ser concluído com sucesso.

Nesse caso, o backend monta a resposta:
- “Não consegui identificar exatamente quais lembretes alterar”
- e reapresenta os candidatos do dia em contexto.

## O problema que ainda sobra

O filtro por data agora está melhor: ela já restringiu a resposta para 27/04.

Mas ainda falta a parte mais importante:
- o servidor **não resolve por conta própria** “13h” → lembrete A
- e “14h” → lembrete B

Ele ainda depende do modelo fazer esse casamento corretamente.

## Próximo ajuste recomendado

## 1. Resolver o alvo no servidor, não no modelo
Criar uma resolução determinística para comandos como:
- “cancelar 14h”
- “alterar 13h para 13h30”
- “trocar o treino das 13”

O servidor deve:
- pegar a lista já filtrada do dia em contexto;
- localizar por horário (`event_at`) e, se houver, por título;
- se houver 1 match exato, usar esse UUID automaticamente;
- só pedir esclarecimento se houver 2+ matches reais.

## 2. Separar subcomandos mistos no backend
Para frases como:
- “alterar 13h para 13h30 e cancelar 14h”

o servidor deve quebrar em duas ações independentes:
- ação A: remarcar 13h → 13h30
- ação B: cancelar 14h

Cada uma resolve seu próprio alvo na lista filtrada.

## 3. Parar de depender do retry do modelo após `uuid_not_in_session`
Hoje, quando o guard rejeita o UUID:
- o servidor devolve `available_reminders`
- e espera que o modelo tente de novo com o id certo

Esse retry ainda é frágil.

Melhor caminho:
- quando houver horário claro na frase original,
- o próprio servidor refaz o match com `available_reminders`
- e executa o delete correto sem depender de nova escolha do modelo.

## Arquivo a ajustar

- `supabase/functions/assistente-virtual/index.ts`

## Resultado esperado

No mesmo fluxo:
1. “o que tenho dia 27?”
2. lista com 13h, 13h15, 14h, 17h
3. “alterar 13h para 13h30 e cancelar 14h”

o servidor deve:
- mapear 13h para o lembrete certo;
- mapear 14h para o lembrete certo;
- cancelar/remarcar sem pedir para você copiar a lista;
- só perguntar algo se realmente houver ambiguidade.

## Detalhe técnico

Hoje existe proteção boa contra exclusão errada:
- `delete_reminder` só aceita ids vistos na sessão;
- se vier id fora da sessão, retorna `uuid_not_in_session`.

O que falta é um resolvedor server-side entre:
- linguagem natural do usuário
- lista filtrada de lembretes já carregada

Sem isso, a segurança está correta, mas a automação ainda falha.
