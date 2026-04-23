

# Esclarecer integração Google Calendar da Júlia

## O que está acontecendo hoje

A Júlia **tem integração com Google Calendar**, mas ela é **one-way** (Júlia → Google) e exige **conexão prévia** em **Configurações → Integrações**. Hoje:

- Você ainda não conectou sua conta Google (verificado no banco: `user_google_tokens` vazio para você).
- Por isso o lembrete "Aula às 18h" foi salvo só no sistema interno e **não foi enviado para o Google Calendar**.
- A Júlia respondeu literalmente "não tenho acesso ao Google Calendar" — tecnicamente correto (ela não *lê* a agenda), mas confuso, porque dá a entender que não existe integração nenhuma.

## O que vou ajustar

**1. Ensinar a Júlia a explicar a integração corretamente**

No prompt em `supabase/functions/assistente-virtual/index.ts`, adicionar uma seção **"Sobre Google Calendar"** com regras:

- Se o usuário perguntar "você salvou no Google Calendar?" / "tem acesso ao Google Calendar?":
  - Verificar (via dado ao vivo já injetado) se o usuário tem `user_google_tokens`.
  - **Se conectado**: responder "Sim, já mandei pra sua agenda do Google" (e citar o email Google conectado).
  - **Se não conectado**: responder algo como "Salvei aqui no sistema. Pra também aparecer no seu Google Calendar, conecta sua conta em **Configurações → Integrações**. Depois disso, todo lembrete que eu criar pra você vira evento automaticamente."
- Nunca dizer só "não tenho acesso" sem explicar o caminho da conexão.

**2. Injetar status de conexão nos "dados ao vivo"**

A função `assistente-virtual` já busca várias tabelas em paralelo no início. Adicionar uma consulta extra a `user_google_tokens` filtrada pelo `userData.user.id` e passar pro prompt um campo simples tipo:

```
GOOGLE_CALENDAR: { conectado: true, email: "voce@gmail.com" }
```
ou
```
GOOGLE_CALENDAR: { conectado: false }
```

Assim a Júlia responde com a verdade do estado atual, sem chutar.

**3. Sinalização visual nos lembretes recém-criados**

Quando a Júlia confirma criação de lembrete ("Pronto! Vou te avisar..."), se o usuário **não** estiver conectado, ela acrescenta uma linha curta no fim:

> 💡 Pra também salvar no seu Google Calendar, conecta em Configurações → Integrações.

Aparece **só uma vez por sessão** (controlado por flag em memória do componente `AssistenteButton.tsx`) pra não virar spam.

## Passo seguinte (você)

Pra testar a sincronização real, basta ir em **Configurações → Integrações → Conectar Google Calendar**. Depois disso, qualquer novo lembrete que a Júlia criar vai aparecer na sua agenda em até 1 minuto (worker roda a cada minuto).

## Fora deste escopo

- Reenviar pro Google os lembretes antigos criados antes da conexão (eles ficam só no sistema interno).
- Permitir que a Júlia *leia* eventos do Google Calendar (continua one-way).

