## Cadastro do WhatsApp da Gráfica — Solução Híbrida

Resolve o problema do número fictício **agora**, sem nenhum risco de banimento, e deixa o terreno preparado para automação real (Cloud API da Meta) em uma próxima sprint — sem retrabalho de UI.

---

### Fase 1 — O que será entregue agora

**1. Nova tabela `company_settings` (singleton)**

Tabela única para dados de identidade e comunicação da empresa, separada da `global_settings` (que é só financeira).

Colunas:
- `id` (uuid, PK)
- `company_name` (text) — ex: "Max Gráfica"
- `whatsapp_number` (text) — formato livre, normalizado para dígitos no front (ex: `5511987654321`)
- `whatsapp_display` (text, opcional) — versão formatada para exibir (ex: `(11) 98765-4321`)
- `email` (text, opcional)
- `address` (text, opcional)
- `logo_url` (text, opcional) — para uso futuro no `ClientViewer`
- `created_at`, `updated_at`

RLS:
- `SELECT` aberto a `authenticated` E `anon` (o `ClientViewer` público precisa ler o número para montar o link `wa.me`).
- `INSERT`/`UPDATE` apenas para admins (`is_profile_admin(auth.uid())`).
- Sem `DELETE`.

Trigger `update_updated_at_column` no `UPDATE`.

Seed de uma linha vazia na própria migration para garantir o singleton.

**2. Nova aba "Empresa" em `/configuracoes`**

Adicionada como primeira aba do `Tabs` existente em `src/pages/Configuracoes.tsx`. Visível para todos, **editável só por admin**.

Campos:
- Nome da empresa
- WhatsApp (input com máscara `(99) 99999-9999`, dica embaixo: *"Será usado nos botões de aprovação de orçamento. Apenas o link wa.me será gerado — nenhuma mensagem é enviada automaticamente."*)
- E-mail de contato
- Endereço
- Upload de logo (bucket público novo `company-assets`, opcional — pode ficar para depois se preferir)

Botão **Salvar** com loading + toast.

**3. Hook `useCompanySettings`**

`src/hooks/useCompanySettings.tsx` — busca a única linha de `company_settings` uma vez, cacheia em context/state, expõe `{ companyName, whatsappNumber, whatsappDisplay, email, ... , loading }`.

Provider montado no topo de `App.tsx` para ficar disponível em rotas protegidas E na rota pública `/view-quote/:id`.

**4. Refactor de `src/lib/quotes-v2/whatsapp.ts`**

- Remove o fallback hardcoded `"5511999999999"` e a leitura de `import.meta.env.VITE_WHATSAPP_NUMBER`.
- `buildWaUrl` continua existindo, mas agora **exige** o telefone como argumento (não tem mais fonte global).
- `getShopPhone()` é removido.

**5. Atualização do `StickyApprovalBar`**

Lê o número via `useCompanySettings()` e o injeta nos `buildWaUrl(...)`.

Estados:
- Enquanto `loading` → botões desabilitados com texto "Carregando…"
- Se `whatsappNumber` vazio → botões desabilitados + tooltip *"Cadastre o WhatsApp da empresa em Configurações"* (e, se o usuário logado for admin visualizando preview, link direto pra `/configuracoes`).

**6. Mensagem de aprovação melhorada**

`buildApprovalMessage` passa a incluir o nome do cliente e o nome da gráfica:

> *"Olá Max Gráfica! Sou o {cliente}, analisei o Orçamento Nº {numero}, escolhi a opção de {opcao} e APROVO a produção."*

Assim você identifica de cara quem está aprovando, mesmo que o número do cliente seja desconhecido.

---

### Por que essa arquitetura suporta a Fase 2 (Cloud API) sem retrabalho

Quando você quiser ativar envio automático de propostas pelo WhatsApp oficial:

1. Adicionamos colunas `meta_phone_number_id` e `meta_access_token` (secret) na mesma tabela.
2. Criamos uma edge function `send-quote-whatsapp` que usa a Cloud API da Meta.
3. O `ClientViewer` ganha um botão extra "Enviar pelo WhatsApp" que dispara a função — mas os botões atuais (`wa.me` no celular do cliente) **continuam funcionando**, porque a fonte do número é a mesma tabela.
4. **Nenhuma tela precisa ser refeita.** O usuário admin já está acostumado a editar em `/configuracoes` → aba Empresa.

---

### Por que NÃO via QR Code (re-confirmando a decisão)

- Bibliotecas tipo `whatsapp-web.js` / `Baileys` violam os Termos de Serviço do WhatsApp → **banimento do número** é praticamente certo a médio prazo.
- Exigem servidor Node persistente 24/7 com a sessão ativa — incompatível com edge functions/Lovable Cloud (que são stateless).
- Se a sessão cai, alguém precisa escanear o QR de novo manualmente — péssima UX para a gráfica.
- Perder o número da empresa = perder histórico inteiro de clientes.

A Cloud API oficial (Fase 2) resolve o mesmo caso de uso de forma legal, gratuita até 1.000 conversas/mês, sem risco.

---

### Checklist técnico

```text
1. Migration aditiva:
   - CREATE TABLE company_settings + RLS + trigger updated_at
   - INSERT inicial (singleton vazio)
2. src/hooks/useCompanySettings.tsx (provider + hook)
3. App.tsx: envolver rotas com <CompanySettingsProvider>
4. src/pages/Configuracoes.tsx: nova aba "Empresa" + form + save
5. src/lib/quotes-v2/whatsapp.ts: remover fallback hardcoded,
   exigir phone como argumento
6. src/components/orcamentos-v2/client-viewer/StickyApprovalBar.tsx:
   consumir hook, estados de loading/vazio
7. Mensagens enriquecidas (nome do cliente + nome da gráfica)
8. QA: testar /view-quote/:id deslogado lendo o número via RLS anon
```

V1 (`/orcamentos`) **permanece intocada** — a refatoração do `whatsapp.ts` afeta só V2, que é onde ele é importado.
