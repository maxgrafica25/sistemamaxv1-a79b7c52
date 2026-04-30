## Resumo das decisões alinhadas

- **Roles**: Admin / Colaborador (mantendo o que existe). Estrutura aceita expansão futura sem refatorar nada agora.
- **Schema profiles**: mantém `display_name` (label visual será "Nome Completo"). Adiciona `is_active`.
- **Email**: SMTP padrão do Lovable Cloud (zero configuração).
- **Status**: ativo/inativo com bloqueio de login real.

---

## Etapa 1 — Restaurar seu admin agora (uma migração rápida)

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE user_id = '056da65d-8552-4163-ae37-11d14d152805'
   OR display_name = 'Marcelle';
```

Após isso → recarregar → aba "Backup & Exportação" volta. Daqui pra frente toda gestão é via UI.

---

## Etapa 2 — Schema do banco

**Migração:**

1. `ALTER TABLE profiles ADD COLUMN is_active boolean NOT NULL DEFAULT true;`
2. Trigger `prevent_last_admin_lockout` em `profiles`: bloqueia `UPDATE` se a operação deixaria o sistema com **zero admins ativos** (cobre tanto rebaixar role quanto desativar o último admin).
3. RPC `list_users_admin()` SECURITY DEFINER que retorna `user_id, display_name, role, is_active, email, last_sign_in_at, email_confirmed_at` fazendo join com `auth.users` — só roda se `is_profile_admin(auth.uid())`.
4. Trigger em `auth.sessions` (ou hook): se o profile correspondente tiver `is_active = false`, `RAISE EXCEPTION` para impedir login. Backup: a UI já bloqueia listando o status.

---

## Etapa 3 — Edge Function `invite-user`

`supabase/functions/invite-user/index.ts`:
- `verify_jwt = true`
- Valida que o chamador é admin via `is_profile_admin(auth.uid())`
- Valida payload com Zod: `{ email, display_name, role: 'admin' | 'colaborador' }`
- Usa `supabase.auth.admin.inviteUserByEmail(email, { data: { display_name }, redirectTo: '<origin>/reset-password' })`
- Após criação, faz `UPDATE profiles SET role = X WHERE user_id = ...` (o trigger `handle_new_user` já criou o profile)
- Retorna `{ success, user_id }`
- Trata erros: email já existe, rate limit, etc.
- Loga em `audit_logs` (`action: 'invite_user'`)

O email do convite usa o template padrão do Lovable Cloud — funciona out-of-the-box.

---

## Etapa 4 — UI: página `/usuarios`

**Arquivos novos:**

- `src/pages/Usuarios.tsx` — página principal
- `src/components/usuarios/InviteUserDialog.tsx` — modal de convite
- `src/components/usuarios/UserActionsMenu.tsx` — dropdown com ações (mudar role, ativar/desativar, reenviar convite)
- `src/hooks/useIsAdmin.tsx` — hook helper já que isso será reutilizado

**Layout da página (estilo consistente com o resto do sistema):**

```text
┌──────────────────────────────────────────────────────────┐
│ 👥 Usuários                          [+ Convidar Usuário] │
├──────────────────────────────────────────────────────────┤
│ Nome                Email          Perfil    Status   ⋯  │
├──────────────────────────────────────────────────────────┤
│ Juliano             ju@..          [Admin]   ● Ativo  ⋯  │
│ Marcelle            ma@..          [Admin]   ● Ativo  ⋯  │
│ Maria               maria@..       [Colab.]  ● Pend.  ⋯  │
└──────────────────────────────────────────────────────────┘
```

**Colunas:** Nome (`display_name`) · Email · Perfil (badge roxo Admin / cinza Colaborador) · Status (verde "Ativo" / amarelo "Convite pendente" / cinza "Inativo") · Ações.

**Estados:** Skeleton enquanto carrega, empty state se não houver usuários, toast (sonner) em todas as ações.

**Modal "Convidar Usuário":**
- Campo Nome Completo (zod: 2-100 chars)
- Campo Email (zod: email válido, max 255)
- Select Perfil: Admin / Colaborador
- Botão "Enviar Convite" com loading
- Mensagem de sucesso explicando que o usuário receberá um email para definir a senha

**Menu de Ações por linha (só visível para admin):**
- Alterar para Admin / Colaborador (com `ConfirmDialog`)
- Desativar / Ativar usuário (com `ConfirmDialog`)
- Reenviar convite (se status = pendente)

---

## Etapa 5 — Sidebar + roteamento

- `src/App.tsx`: adicionar rota `/usuarios` dentro do `<ProtectedRoute>`
- `src/components/Sidebar.tsx`: adicionar item "Usuários" com ícone `UserCog`, posicionado logo antes de "Configurações", **renderizado apenas se `profile?.role === "admin"`**
- A página em si também checa admin no topo e mostra mensagem "Acesso restrito a administradores" se não for

---

## Etapa 6 — Página `/reset-password` (verificação)

A página `src/pages/ResetPassword.tsx` já existe. Vou conferir se ela funciona tanto para fluxo de "esqueci minha senha" quanto para "primeiro acesso via convite" (ambos usam `type=recovery` ou `type=invite` no link). Se necessário, ajusto o copy para diferenciar: "Defina sua senha de acesso" quando vier de convite.

---

## Fora de escopo (NÃO entra agora)

- **Múltiplos perfis (Produção/Vendas)** — fica para depois conforme decidido. Hoje só Admin/Colaborador.
- **Componente "Configurações de SMTP"** — descartado: o Lovable Cloud já gerencia email nativamente, não há SMTP externo para configurar. Mostrar um guia para colar chave em painel externo seria informação incorreta para este projeto.
- **Reset de senha de outro usuário pelo admin** — usuário pode usar "Reenviar convite" ou "Esqueci minha senha" na tela de login.

---

## Detalhes técnicos consolidados

| Item | O que muda |
|---|---|
| Migração 1 | Restaurar seu role admin |
| Migração 2 | `profiles.is_active`, trigger `prevent_last_admin_lockout`, RPC `list_users_admin()`, trigger de bloqueio de login para inativos |
| Edge Function | `supabase/functions/invite-user/index.ts` (novo) |
| Pages | `src/pages/Usuarios.tsx` (novo) |
| Components | `InviteUserDialog.tsx`, `UserActionsMenu.tsx` (novos) |
| Hook | `useIsAdmin.tsx` (novo) |
| Editados | `src/App.tsx`, `src/components/Sidebar.tsx` |
| Auditoria | Cada ação grava em `audit_logs` |
