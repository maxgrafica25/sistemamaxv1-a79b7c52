# Sistema Max (OrçaGráfica) – sistema de gestão da Max Gráfica

Criado no Lovable e migrado em 27/10/2026 para infraestrutura própria. **Não editar mais pelo Lovable.**

## Como falar com o dono do projeto
- Juliano, gestor da Max Gráfica. Não é programador: português do Brasil, passo a passo, uma etapa por vez, pedindo print das telas.
- Sempre dizer quando algo gera custo. Nunca pedir chaves/senhas no chat (vão em Secrets do GitHub, Variables do Railway ou no painel do Supabase).

## Onde roda
- **Banco/Auth/Storage/Edge Functions:** Supabase próprio, projeto `sistema-max` (ref `drjbbpvmxtejmxxilmey`, São Paulo), organização "Micro Saas Max Grafica" (plano Free). Não mexer na organização "Sistema GRP".
- **Telas:** Railway, projeto `efficient-courage` (o mesmo da Júlia), serviço `sistemamaxv1-a79b7c52`, build pelo `Dockerfile` (Nginx). Variáveis: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `PORT=80`. Endereço: **https://sistema.maxgraficadigital.com.br** (DNS na Cloudflare, CNAME `sistema` com proxy laranja; Site URL do Supabase Auth já aponta para ele). Endereço técnico: https://sistemamaxv1-a79b7c52-production.up.railway.app
- **Deploy:** push na `main` → Railway publica as telas; `.github/workflows/supabase.yml` aplica migrações e publica as Edge Functions (secrets `SUPABASE_ACCESS_TOKEN` e `SUPABASE_DB_PASSWORD`). `.github/workflows/build.yml` confere se o Docker compila.
- Admin: `profiles.role = 'admin'`. O gatilho `prevent_role_escalation_trigger` desfaz em silêncio mudanças de papel feitas por quem não é admin (inclusive pelo SQL Editor).

## Código
- React + Vite + TypeScript + shadcn, Supabase JS. Multi-empresa (`empresa_id`, RLS). Tipos do banco em `src/integrations/supabase/types.ts`.
- As migrações antigas do Lovable estavam incompletas (faltava a coluna `equipment_consumables.mode`); conferir novas mudanças num Postgres local com a imagem `supabase/postgres` antes do push.

## Regras de preço (decididas com o Juliano em 27/10/2026)
- Valor da hora = (despesas mensais + salários × 1,45 + depreciação do que NÃO tem contador) ÷ (pessoas × horas/mês). Máquinas com contador (impressoras, plotters de recorte) têm depreciação e manutenção **só** no custo por página em Equipamentos, para não cobrar duas vezes.
- Custo por página: rendimento do fabricante (5%); só toner/tinta (`scales_with_coverage`) multiplicam pela cobertura (20% = ×4). Itens C/M/Y são `mode = 'color_only'`.
- Despesas de venda (`global_settings`): imposto 10% (`invoice_pct`; `tax_pct` = 0 para não somar duas vezes), perda 5% (monitorar com as perdas registradas), cobrança 7%, lucro 33%. Preço = custo ÷ 0,45.
  - Imposto: contador estima 8–10% (Simples); Juliano fixou 10%. Cobrança 7% = taxa do parcelamento em até 3x sem juros, oferecido em todo pedido. Tabela sempre no cenário regularizado (com nota e cartão); parte das vendas hoje sai sem nota/no Pix, o que vira folga de caixa, não base de preço.
  - Estratégia de preço proposta (falta calibrar): preço de tabela pelo mercado + piso calculado (custo + tempo ÷ 0,45) + desconto por quantidade pela fórmula taxa de preparação + preço por folha + pedido mínimo + desconto no Pix. Decidido em 28/10: desconto no Pix 5%; tempo médio de preparação por pedido 2,5 min (≈ R$ 2,04 de custo). Aguardando: exportação de pedidos do Tiny e pesquisa de preços de concorrentes (cliente oculto).
- As faixas de mark-up do Preço Impressão (`markup_tiers`, com 40% de custo fixo) são do método antigo e ainda precisam ser revistas.

## Pendências (27/10/2026)
- Tela "Hoje" (`src/pages/Dashboard.tsx`) mostra números de exemplo fixos no código.
- Segredos das Edge Functions ainda não configurados no Supabase novo (Gemini `GOOGLE_API_KEY`, Google Calendar OAuth, `BROWSERLESS_API_KEY`, `CRON_SECRET`); cron jobs do Lovable não migrados.
- Próximo: cadastros de preço (despesas fixas/valor hora, papéis, impressão, processos) a partir da planilha "Formação de Preço de Venda Impressões" e depois ligar a Júlia aos orçamentos.
