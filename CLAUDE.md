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

## Comunicação visual — custos levantados em 28/10/2026 (NF-e da Bluebird, out/2025–out/2026, 32 notas)
- Mídias (rolos de 50 m): lona 440 g brilho R$ 8,40–8,60/m², fosca R$ 8,80–8,90/m²; adesivo Ritrama M80 1,05 m R$ 660–690/cx (~R$ 12,60–13,10/m²), 1,26 m R$ 793–818/cx; perfurado MPI R$ 14,50–15,90/m²; vinil MPX transparente R$ 15,90–17,90/m linear; PS branco 2 mm R$ 76/chapa 2×1 (R$ 38/m²), 3 mm R$ 100–120/chapa (R$ 50–60/m²); PVC expandido 3 mm R$ 87/chapa 1,22×2,44 (~R$ 29/m², placas pequenas); bastão 1,05 R$ 2,40, 1,50 R$ 3,50; ponteira R$ 0,23–0,26.
- Volume comprado em ~12,6 meses: ~742 m² de lona + ~546 m² de adesivo + ~49 m² de perfurado ≈ 105 m²/mês (≈ 95 m² impressos/mês descontando sobra).
- Signstar (ecosolvente): tinta R$ 220/L; software estima 3,6–4,7 ml/m² (usar ~6 ml/m² com limpezas ≈ R$ 1,30/m²); velocidade ~4,6 m²/h (360×720) e ~7,7 m²/h (360×360). Depreciação (R$ 65 mil − 10 mil)/60 = R$ 917/mês ÷ ~95 m² ≈ R$ 9,60/m² — máquina usada ~20 h/mês (muita capacidade ociosa).
- Decisão 28/10: manter os preços de venda da planilha CV (já dão ~40% de lucro real) e meta CV = 40%, piso 25% (aviso na calculadora, só admin). Migração `20261028120000_cv_custos_reais_notas.sql` pôs custos reais e criou Placa PS 2/3 mm (preço = PVC + R$ 40/m²). Lucro real no engine desconta imposto + cartão + perda.
- Placas (migração `20261028150000_cv_placas_composicao.sql`): custo da chapa inclui o adesivo impresso (R$ 14,19/m²); "Aplicação do adesivo + corte" = 5 min + 2 min/m de contorno + 8 min/m² (11 placas PS 2 mm 30×42 em 50 min); laminação = adesivo transparente + 5 min/m². Calculadora tem 2º acabamento opcional. Valor do minuto na planilha de tempos do Juliano: R$ 0,87 (sistema: R$ 0,81).
- Planilha atual de orçamento CV ("Orçamentos Adesivos, Lonas, Placas e Magnetos"): preço = custo + "lucro" fixo em R$ por m²; sem imposto/cartão/perda explícitos; valor mínimo R$ 35. Placa PS grande não tem cadastro próprio (só "PVC" a R$ 26/m²).

## Pendências (atualizado 28/10/2026)
- Ajuste do balcão (impressão laser): degrau do P&B (R$ 1,00 até 50 → R$ 0,50 a partir de 51), pedido mínimo, desconto 5% no Pix; rever `markup_tiers` (40% de custo fixo, método antigo). Dados de vendas: 91% dos pedidos coloridos têm até 20 un; ~55% do faturamento do Tiny está em itens sem cadastro (provavelmente CV).
- Faturamento médio (Tiny, 12 meses): R$ 58,6 mil/mês; custos fixos ~R$ 35,9 mil/mês.
- Pesquisa de concorrentes (cliente oculto) — roteiro de 9 itens já passado ao Juliano; calibrar balcão e CV (ex.: PS 3 mm está em ~36% de lucro, meta 40%).
- Tela "Hoje" (`src/pages/Dashboard.tsx`) mostra números de exemplo fixos no código.
- Marcelle (sócia, gestão) ainda não tem usuário no sistema; o lucro na calculadora CV só aparece para `role = 'admin'`.
- Segredos das Edge Functions ainda não configurados no Supabase novo (Gemini `GOOGLE_API_KEY`, Google Calendar OAuth, `BROWSERLESS_API_KEY`, `CRON_SECRET`); cron jobs do Lovable não migrados.
- Ligar a Júlia (repo `maxgrafica25/julia`) aos orçamentos do sistema.
- Revisão dos cadastros do Tiny (produtos padronizados, CV lançado como item avulso).
