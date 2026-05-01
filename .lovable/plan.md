
# Reforço de Segurança no Fluxo de Recuperação de Senha

Plano dividido em 4 entregas, na ordem de prioridade que você sugeriu. **Item 5 (Rate Limiting) ficará de fora** — a plataforma ainda não tem primitivos confiáveis para isso e o Supabase Auth já aplica rate limit nativo nas rotas de recovery. Posso revisitar quando houver infra dedicada.

---

## 1. HIBP Check + Senha mínima de 8 caracteres

**Backend (Supabase Auth)**
- Ativar `password_hibp_enabled: true` via tool `configure_auth`.
- Definir `password_min_length: 8`.
- Manter requisitos de caracteres no padrão "letters + digits" (não vou exigir símbolos para não atrapalhar o time interno).

**Frontend**
- `src/pages/Auth.tsx`: trocar constante `MIN_PASSWORD_LENGTH = 6` → `8`. Atualizar mensagens e o placeholder ("Mínimo 8 caracteres").
- `src/pages/ResetPassword.tsx`: mesma troca.
- Tratar o erro retornado pelo HIBP (`weak_password` / mensagem do Supabase) com toast amigável: *"Esta senha apareceu em vazamentos públicos. Escolha outra."*

---

## 2. E-mail de confirmação pós-redefinição

Como o reset hoje passa por `supabase.auth.updateUser({ password })` direto no cliente, vou criar um caminho server-side para disparar o e-mail logo após a troca, sem expor SMTP no front.

**Nova edge function: `notify-password-changed`**
- Recebe nada do body (usa o JWT do usuário autenticado pós-reset).
- Resolve `user_id`, `email`, `display_name`, `ip` (do header `x-forwarded-for`) e `user_agent`.
- Envia e-mail usando a **infraestrutura de e-mail do Lovable Cloud** (a mesma que já trataremos no item 4 — vou rodar `setup_email_infra` se ainda não existir, e `scaffold_transactional_email` para criar o template).
- Template **`password-changed.tsx`**:
  - Assunto: `Sua senha foi alterada — Sistema MaxV`
  - Corpo: saudação com nome, data/hora (timezone America/Sao_Paulo), IP, user-agent resumido, botão "Não fui eu — falar com suporte" (mailto ou link configurável).
  - Aviso: "Se foi você, ignore este e-mail."
  - Branding roxo (cor primária do projeto), logo se existir em `public/`.
- Após enviar, grava `password_reset_succeeded` em `audit_logs` (ver item 3).

**Integração no front (`ResetPassword.tsx`)**
- Após `updateUser({ password })` retornar OK, chamar `supabase.functions.invoke("notify-password-changed")`.
- Falha no envio do e-mail **não bloqueia** o sucesso do reset (apenas loga via `handleError` em modo silencioso).

---

## 3. Audit logs explícitos para reset de senha

A tabela `audit_logs` já existe com colunas `action / entity_type / entity_id / entity_name / details`. Vou usar o campo `details` em JSON-string para guardar IP + user_agent + metadata (sem alterar schema).

**Eventos a registrar**

| Evento | Onde é gravado | Quem grava |
|---|---|---|
| `password_reset_requested` | Após `signInWithOtp` no `Auth.tsx` (sucesso ou não — sempre, para evitar enumeração) | Cliente, com `entity_type='auth'`, `entity_name=email mascarado` |
| `password_reset_succeeded` | Edge function `notify-password-changed` | Server (com IP real) |
| `password_reset_failed_token_invalid` | `ResetPassword.tsx` quando `isRecovery=false` após checagem | Cliente |
| `password_reset_failed_token_expired` | `ResetPassword.tsx` quando `updateUser` retorna erro de token expirado | Cliente |
| `admin_password_reset_notified_others` | Edge function (item 4) | Server |

**Helper `src/lib/audit.ts`**
- Adicionar helper `logAuthEvent(action, { email?, details? })` que aceita usuário não autenticado (a policy atual exige `authenticated` — vou trocar para `anon, authenticated` apenas para INSERT, mantendo SELECT/DELETE como estão; ou, alternativa, gravar via edge function `notify-password-changed` para os eventos pós-login). Vou seguir pela **edge function** para os eventos do servidor, e relaxar a policy de INSERT para `anon` apenas com `entity_type='auth'` (CHECK), para os eventos do cliente não autenticado.
- E-mail no `entity_name` será **mascarado** (`jo***@gmail.com`) para não vazar lista de usuários se alguém ler logs.

---

## 4. Notificar outros admins quando admin redefine senha

**Lógica na mesma edge function `notify-password-changed`**
- Após enviar o e-mail de confirmação, verifica via `is_profile_admin(user_id)`.
- Se for admin: busca `profiles` com `role='admin' AND is_active=true AND user_id <> :resetter`, e envia o template **`admin-password-alert.tsx`** para cada um.
- Template:
  - Assunto: `Alerta de Segurança — Senha de admin alterada`
  - Corpo: nome do admin que trocou, data/hora, IP, user-agent, botão "Revisar atividade" (link para `/auditoria`).
- Grava `admin_password_reset_notified_others` em `audit_logs` com lista de admins notificados.

---

## Detalhes técnicos

**Pré-requisito de e-mail (executado no início do item 2):**
1. `email_domain--check_email_domain_status` — se não houver domínio configurado, mostro o diálogo `<lov-open-email-setup>` para você configurar antes de prosseguir.
2. `email_domain--setup_email_infra` (se ainda não rodou).
3. `email_domain--scaffold_transactional_email` para gerar a função `send-transactional-email` e a infra de fila.
4. Crio os 2 templates novos (`password-changed`, `admin-password-alert`) em `supabase/functions/_shared/email-templates/`.
5. `notify-password-changed` chama `send-transactional-email` (ou enfileira via `enqueue_email`) — mesma fila pgmq com retry.

**Migrations**
- Apenas uma: relaxar policy `Authenticated can insert audit_logs` para também aceitar `anon` quando `action LIKE 'password_reset_%'` e `entity_type = 'auth'`. Mantém a policy admin-only de DELETE.

**Arquivos que vou criar/editar**

```text
supabase/functions/notify-password-changed/index.ts          [novo]
supabase/functions/_shared/email-templates/password-changed.tsx     [novo]
supabase/functions/_shared/email-templates/admin-password-alert.tsx [novo]
supabase/config.toml                                         [+ bloco da função]
src/pages/Auth.tsx                                           [MIN_PASSWORD_LENGTH=8 + log requested]
src/pages/ResetPassword.tsx                                  [MIN=8 + invoke notify + logs]
src/lib/audit.ts                                             [+ logAuthEvent helper]
```

E uma migration para a policy do `audit_logs`.

---

## Fora do escopo

- **Rate limiting custom** (item 5 do seu pedido): a plataforma não tem primitivos para isso e o Supabase Auth já limita as chamadas de `signInWithOtp` e `updateUser` no servidor. Se quiser uma camada extra mais à frente, posso fazer com tabela própria + bloqueio na edge function — mas não é o caminho recomendado hoje.
- Reset forçado por outro admin (já tem o fluxo de convite/inativar usuário em `Usuarios.tsx`).
- Histórico de hashes de senha (Supabase Auth não expõe).

Confirma esse plano? Assim que aprovar, sigo na ordem: HIBP → e-mail confirmação → audit logs → notificação admin.
