

# Resolver login do emailparaojuliano@gmail.com

## Diagnóstico

A conta existe e está saudável (e‑mail confirmado, sem bloqueio, último login em 17/04). O erro **"Invalid login credentials"** é **senha errada**, não bug.

O que aconteceu nos logs hoje 14:33:
1. Usuário foi em **Criar Conta** e digitou e‑mail + uma senha nova → Supabase respondeu `user_repeated_signup` (conta já existe; senha **não foi alterada**).
2. Em seguida tentou **Entrar** 4× com essa mesma senha nova → todas rejeitadas, porque a senha real cadastrada é outra (a usada em 17/04).

## Solução (sem código)

Peça pra ele clicar em **"Esqueci minha senha"** na tela de login:

1. Digita `emailparaojuliano@gmail.com` → **Enviar Link de Recuperação**.
2. Abre o e‑mail (checar spam) → clica no link.
3. Cai em `/reset-password` → define senha nova.
4. Volta no login com a senha nova → entra normal.

O fluxo de recuperação já está implementado em `src/pages/Auth.tsx` (modo `recoveryMode`) e a página `/reset-password` está pública.

## Alternativa rápida (admin)

Se o usuário não receber o e‑mail de recuperação (problema de SMTP/spam), você pode resetar manualmente. Existem dois caminhos:

- **Pelo painel Cloud:** abrir **Backend → Users**, achar o usuário, usar a opção de enviar magic link / definir senha.
- **Via script já pronto:** `scripts/reset-passwords-bulk.ts` aceita uma lista de e‑mails e dispara o link de recuperação em lote (já existe no projeto, não precisa criar nada).

## Melhoria opcional (requer aprovação separada)

Hoje o signup com e‑mail já existente mostra a mensagem genérica do Supabase ("User already registered"), o que confunde — o usuário acha que criou conta nova. Posso ajustar `Auth.tsx` pra detectar esse erro específico no `handleSignup` e mostrar:

> Esse e‑mail já tem conta. Use **Entrar** ou clique em **Esqueci minha senha**.

Avise se quer que eu faça essa melhoria também.

## Fora deste escopo

- Trocar senha do usuário direto via SQL (não dá — `auth.users.encrypted_password` exige hash bcrypt do GoTrue, não pode ser feito por migration).
- Mudar política de senhas ou fluxo de signup.

