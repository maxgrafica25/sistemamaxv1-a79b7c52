# Sistema Max (OrçaGráfica) – sistema de gestão da Max Gráfica

Criado no Lovable e migrado em 27/10/2026 para infraestrutura própria. **Não editar mais pelo Lovable.**

## Como falar com o dono do projeto
- Juliano, gestor da Max Gráfica. Não é programador: português do Brasil, passo a passo, uma etapa por vez, pedindo print das telas.
- Sempre dizer quando algo gera custo. Nunca pedir chaves/senhas no chat (vão em Secrets do GitHub, Variables do Railway ou no painel do Supabase).

## Onde roda
- **Banco/Auth/Storage/Edge Functions:** Supabase próprio, projeto `sistema-max` (ref `drjbbpvmxtejmxxilmey`, São Paulo), organização "Micro Saas Max Grafica" (plano Free). Não mexer na organização "Sistema GRP".
- **Telas:** Railway, projeto `efficient-courage` (o mesmo da Júlia), serviço `sistemamaxv1-a79b7c52`, build pelo `Dockerfile` (Nginx). Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `PORT=80`. Endereço: https://sistemamaxv1-a79b7c52-production.up.railway.app
- **Deploy:** push na `main` → Railway publica as telas; `.github/workflows/supabase.yml` aplica migrações e publica as Edge Functions (secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`). `.github/workflows/build.yml` confere se o Docker compila.
- Admin: `profiles.role = 'admin'`. O gatilho `prevent_role_escalation_trigger` desfaz em silêncio mudanças de papel feitas por quem não é admin (inclusive pelo SQL Editor).

## Código
- React + Vite + TypeScript + shadcn, Supabase JS. Multi-empresa (`empresa_id`, RLS). Tipos do banco em `src/integrations/supabase/types.ts`.
- As migrações antigas do Lovable estavam incompletas (faltava a coluna `equipment_consumables.mode`); conferir novas mudanças num Postgres local com a imagem `supabase/postgres` antes do push.

## Pendências (27/10/2026)
- Tela "Hoje" (`src/pages/Dashboard.tsx`) mostra números de exemplo fixos no código.
- Chrome mostra aviso "Perigoso" no domínio do Railway: usar domínio próprio (ver onde está o maxgraficadigital.com.br).
- Segredos das Edge Functions ainda não configurados no Supabase novo (Gemini `GOOGLE_API_KEY`, Google Calendar OAuth, `BROWSERLESS_API_KEY`, `CRON_SECRET`); cron jobs do Lovable não migrados.
- Próximo: cadastros de preço (despesas fixas/valor hora, papéis, impressão, processos) a partir da planilha "Formação de Preço de Venda Impressões" e depois ligar a Júlia aos orçamentos.
