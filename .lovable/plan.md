
# Reforço de Segurança — Itens 2 e 4 via SendGrid

Os itens 1 (HIBP + senha mínima 8) e 3 (audit logs) já estão entregues. Este plano cobre **apenas** os itens 2 e 4, agora usando **SendGrid** em vez da infra de e-mail do Lovable Cloud.

---

## Pré-requisitos do seu lado (antes de eu começar)

1. Conta no SendGrid criada (free tier, 100 e-mails/dia).
2. **Domain Authentication** configurada no SendGrid para `seudominio.com` (Settings → Sender Authentication → Authenticate Your Domain). Você adiciona os 3 CNAMEs que o SendGrid pede no seu provedor de DNS e aguarda verificação.
3. **Single Sender** ou **Sender Identity** verificada para o e-mail remetente (ex.: `seguranca@seudominio.com` ou `no-reply@seudominio.com`).
4. **API Key** com permissão **Mail Send → Full Access** gerada (Settings → API Keys → Create API Key → Restricted Access).

Quando tiver isso pronto, me avisa o e-mail remetente que você quer usar e cola a API Key — eu já preparo o secret prompt.

---

## Arquitetura

```text
ResetPassword.tsx  ──► supabase.functions.invoke('notify-password-changed')
                                    │
                                    ▼
              ┌──────────────────────────────────────┐
              │  edge function notify-password-changed │
              │  1. Valida JWT do usuário             │
              │  2. Resolve email/nome/IP/UA          │
              │  3. Renderiza HTML do template        │
              │  4. POST https://api.sendgrid.com/v3/mail/send │
              │  5. Se admin: busca outros admins +   │
              │     dispara segundo template          │
              │  6. Grava audit_logs                  │
              └──────────────────────────────────────┘
```

---

## Edge Function `notify-password-changed`

**Arquivo:** `supabase/functions/notify-password-changed/index.ts`

**Fluxo:**
1. Lê `Authorization` header → valida JWT → obtém `user_id`, `email`.
2. Busca `profiles` (display_name, role, is_active) via service-role client.
3. Captura IP do header `x-forwarded-for` e `user-agent`.
4. Renderiza HTML do template `password-changed` (string template literal — sem React Email; SendGrid quer HTML puro).
5. Chama SendGrid:
   ```
   POST https://api.sendgrid.com/v3/mail/send
   Authorization: Bearer ${SENDGRID_API_KEY}
   Content-Type: application/json
   ```
   com payload `{ personalizations, from, subject, content }`.
6. Se `is_profile_admin(user_id) === true`:
   - Busca `profiles` com `role='admin' AND is_active=true AND user_id <> :resetter` + `auth.users.email` via service role.
   - Para cada admin, dispara o template `admin-password-alert` (loop sequencial, com `Promise.allSettled` para não derrubar tudo se um falhar).
   - Grava `admin_password_reset_notified_others` em `audit_logs` com a lista de e-mails notificados (mascarados).
7. Sempre retorna 200 mesmo se o e-mail falhar (não bloqueia o reset). Erros são logados em `audit_logs` como `password_reset_email_failed` com `details.provider = 'sendgrid'` + status code.

**Configuração:**
- Não precisa de bloco em `supabase/config.toml` (verify_jwt default = true para esta função, já que validamos identidade do usuário).
- CORS headers padrão.

---

## Templates (HTML strings, embutidos na função)

Como SendGrid recebe HTML puro no campo `content`, vou manter os templates como **funções TypeScript que retornam string** dentro de `supabase/functions/notify-password-changed/templates.ts`. Não precisa de React Email aqui.

### `password-changed.ts`
- **Assunto:** `Sua senha foi alterada — Sistema MaxV`
- **Conteúdo:**
  - Saudação com `display_name`
  - Data/hora formatada em `America/Sao_Paulo`
  - IP + User-Agent resumido
  - Botão CTA "Não fui eu — falar com suporte" (mailto configurável)
  - Aviso "Se foi você, ignore este e-mail."
- **Estilo:** branding roxo (cor primária do projeto), inline CSS, fundo branco, container 600px (compatível com clientes de e-mail).

### `admin-password-alert.ts`
- **Assunto:** `Alerta de Segurança — Senha de admin alterada`
- **Conteúdo:**
  - Nome do admin que trocou
  - Data/hora, IP, User-Agent
  - Botão "Revisar atividade" → link para `${SITE_URL}/auditoria`
- Mesmo estilo visual.

`SITE_URL` virá de uma constante baseada em `Deno.env.get('SUPABASE_URL')` ou de um secret opcional `APP_PUBLIC_URL` (recomendo o segundo — me confirma a URL pública que devo usar: `https://sistemamaxv1.lovable.app` ou seu domínio próprio?).

---

## Secrets necessários

Vou solicitar via `add_secret`:
- **`SENDGRID_API_KEY`** — API Key do SendGrid (Restricted, Mail Send Full Access).
- **`SENDGRID_FROM_EMAIL`** — e-mail remetente verificado (ex.: `no-reply@seudominio.com`).
- **`SENDGRID_FROM_NAME`** — nome do remetente (default: `Sistema MaxV`).
- **`APP_PUBLIC_URL`** *(opcional)* — URL base para o link de auditoria. Se não definir, uso `https://sistemamaxv1.lovable.app`.

---

## Audit logs adicionais

Adiciono no helper `src/lib/audit.ts` (ou direto na edge function) os seguintes eventos:
- `password_reset_email_sent` — quando o SendGrid retorna 202.
- `password_reset_email_failed` — quando retorna erro (com status + body resumido).
- `admin_password_reset_notified_others` — com `details.notified_admins = ['ad***@x.com', ...]`.

A migration que relaxou a policy de INSERT em `audit_logs` para `entity_type='auth' AND action LIKE 'password_reset_%'` **já cobre esses novos eventos**. Não preciso de nova migration.

> Nota: para `admin_password_reset_notified_others` (que não começa com `password_reset_`), vou usar o prefixo `password_reset_admin_notified` para encaixar na policy existente.

---

## Frontend

**Nenhuma mudança em `ResetPassword.tsx`** — a chamada `supabase.functions.invoke("notify-password-changed")` já foi adicionada no item 1 e funciona com try/catch silencioso. Quando a função for deployada, ela passa a responder de verdade.

---

## Arquivos que vou criar/editar

```text
supabase/functions/notify-password-changed/index.ts        [novo]
supabase/functions/notify-password-changed/templates.ts    [novo]
src/lib/audit.ts                                           [+ 2 helpers de log opcionais]
```

---

## Fora do escopo (não muda)

- Item 1 (HIBP + senha mínima 8): **já entregue**.
- Item 3 (audit logs base): **já entregue**.
- Item 5 (rate limiting custom): permanece fora.
- Infra de e-mail do Lovable Cloud: **não vou ativar** — você escolheu SendGrid.

---

## Próximo passo

Me responde com:
1. ✅ "Pode prosseguir, já tenho a API Key" → eu inicio pedindo o secret `SENDGRID_API_KEY` (e os demais).
2. 📧 O e-mail remetente verificado no SendGrid.
3. 🔗 Confirma se a URL de auditoria deve ser `https://sistemamaxv1.lovable.app/auditoria` ou outra.

Aprovação do plano pode vir junto com essas infos.
