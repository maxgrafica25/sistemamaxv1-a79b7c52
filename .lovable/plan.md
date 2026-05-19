## Problema
O link de recuperação de senha está sendo gerado apontando para a URL de **preview do Lovable** (`id-preview--667f8a1f-...lovable.app`), que é privada e exige login no workspace do Lovable. Resultado: o usuário (juliano@maxgraficadigital.com.br) recebe "Access denied" antes de chegar em `/reset-password`.

Causa: em `src/pages/Auth.tsx`, o `emailRedirectTo` usa `window.location.origin`. Se o reset é solicitado a partir da URL de preview, o link no e-mail aponta para a preview.

## Solução

### 1. Fixar a URL pública de destino no código
Em `src/pages/Auth.tsx`, substituir `window.location.origin` por uma URL pública estável:

- Criar helper `getPublicAppUrl()` que retorna:
  - `https://sistemamaxv1.lovable.app` quando `window.location.hostname` contém `id-preview--` ou `lovable.dev`
  - `window.location.origin` caso contrário (domínio próprio ou produção)
- Usar esse helper no `emailRedirectTo` do `signInWithOtp` (recuperação) e no `emailRedirectTo` do `signUp`.

### 2. Configurar Redirect URLs no backend (Lovable Cloud)
No painel de autenticação (Cloud → Users → URL Configuration), garantir que estão na allowlist:
- `https://sistemamaxv1.lovable.app/reset-password`
- `https://sistemamaxv1.lovable.app/**` (curinga)
- Qualquer domínio próprio futuro

E definir **Site URL** = `https://sistemamaxv1.lovable.app`.

### 3. Reenviar o link para o Juliano
Após o deploy, solicitar novo "Esqueci minha senha" — o novo link irá direto para `sistemamaxv1.lovable.app/reset-password`, sem passar pelo `auth-bridge` do Lovable.

## Arquivos alterados
- `src/pages/Auth.tsx` — adicionar helper e trocar 2 ocorrências de `emailRedirectTo`.

## Observações
- Links antigos já enviados continuarão quebrados — é preciso gerar um novo após a correção.
- A solução é puramente de frontend + configuração; nenhum schema ou Edge Function é alterado.
