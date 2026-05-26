# Problema

Quando você copia o link de um orçamento dentro do editor do Lovable (preview), o `copyPublicQuoteLink` usa `window.location.origin`, que vira algo como `https://id-preview--....lovable.app/p/0123`. Ao abrir esse link, o cliente cai na tela de **Login do Lovable** (foi o que apareceu no print) porque URLs de preview são protegidas.

O link público correto é o do app publicado: `https://sistemamaxv1.lovable.app/p/0123` (ou, no futuro, um domínio próprio).

# Solução

Permitir configurar uma "URL pública do app" em **Configurações → Empresa** e usar essa URL como base de todos os links compartilhados com o cliente. Quando vazio, cai em `window.location.origin` (comportamento atual).

## Mudanças

1. **Banco** — adicionar coluna `public_base_url text` em `company_settings` (nullable, sem default).
2. **Configurações → Empresa** (`CompanyTab.tsx`) — novo campo "URL pública do sistema (para links de orçamento)" com placeholder `https://sistemamaxv1.lovable.app`. Validar que começa com `https://` e remover barra final ao salvar.
3. **Hook `useCompanySettings`** — já carrega tudo da tabela, só expor o novo campo.
4. **Helper `buildPublicQuoteUrl(quoteNumber, baseUrl?)`** em `src/lib/quotes/quick-actions.ts`:
   - Se `baseUrl` informado → usa ele.
   - Senão, se `window.location.hostname` contém `lovable.app`, `lovableproject.com` ou `id-preview--` → mostra `toast.error` orientando configurar a URL pública e **não copia** (evita enviar link quebrado por engano).
   - Caso contrário (domínio próprio em produção) → usa `window.location.origin`.
5. **Call sites** — atualizar `copyPublicQuoteLink` para receber `baseUrl` opcional. Os dois locais que chamam (`OrcamentosV3.tsx`, `NewQuoteFormV3.tsx`) e o `EngagementPopover.tsx` passam `companySettings.public_base_url`.
6. **Configuração inicial** — após aplicar a migração, preencher automaticamente `public_base_url = 'https://sistemamaxv1.lovable.app'` para a empresa atual via SQL na mesma migração (assim já funciona sem clique).

## Fora de escopo

- Não mexer no roteamento, na RPC `get_public_quote` nem na página `ClientViewerV3`.
- Não criar domínio próprio — só preparar a configuração para quando você adicionar um.

Posso aplicar?
