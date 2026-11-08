# Contexto da Max Gráfica para outros projetos (Claude)

Documento para orientar qualquer sessão do Claude que vá trabalhar num sistema novo da Max Gráfica (ex.: pré-impressão)
e precise conhecer o que já existe. Atualizado em 08/11/2026. **Não contém senhas nem chaves.**

## 1. Quem é o dono e como falar com ele
- **Juliano**, gestor da Max Gráfica (marca **Maxgraphi – Criação Digital & Soluções Gráficas**), Charqueadas/RS.
  Sócia: **Marcelle** (gestão). Equipe: Erika, Rebeca e o número fixo "Pessoal da Gráfica".
- Não é programador: responder em **português do Brasil**, passo a passo, **uma etapa por vez**, pedindo **print** das telas.
- Sempre dizer quando algo **gera custo** (servidor, IA, WhatsApp, serviços pagos).
- **Nunca pedir que cole chaves/senhas no chat**: elas vão em Variables do Railway, Secrets do GitHub ou no painel do Supabase.

## 2. Sistemas que já existem
| Sistema | O que faz | Onde |
|---|---|---|
| **Sistema Max** (OrçaGráfica) | Gestão: orçamentos, **Tabela de Preços** de impressão, **calculadora de comunicação visual**, equipamentos e custo por página, clientes | GitHub `maxgrafica25/sistemamaxv1-a79b7c52` · React + Vite + TypeScript + shadcn · banco/login no **Supabase** (projeto `sistema-max`, ref `drjbbpvmxtejmxxilmey`, São Paulo, plano Free) · telas no Railway · https://sistema.maxgraficadigital.com.br |
| **Júlia** | Assistente no **WhatsApp** da equipe e da gestão: contadores das impressoras, peças e durabilidade, aproveitamento de papel, orçamentos (produto, impressos, comunicação visual, offset terceirizado), pedidos de compra, compromissos, consultas ao Tiny, fiscal, marketing | GitHub `maxgrafica25/julia` · Python 3.12 + FastAPI + PostgreSQL (Railway) + Claude (Anthropic) · dashboard da gestão em `/dashboard` |
| **Tiny (Olist ERP)** | ERP oficial: produtos, clientes, pedidos de venda/PDV, notas, propostas comerciais | API v3 (OAuth; a Júlia já está conectada). Plano "Construa": **30 consultas por minuto** |

Os dois repositórios têm um `CLAUDE.md` (regras, decisões, pendências) e a Júlia tem `docs/HISTORICO.md`
(histórico detalhado). **Se tiver acesso ao GitHub, leia esses arquivos antes de começar**: são a fonte mais completa.

Deploy dos dois: **push na `main` → Railway publica sozinho** (projeto Railway "Max Grafica"). Antes de cada push,
rodar os testes (Júlia: `python -m pytest`; Sistema Max: o build/CI do GitHub).

## 3. Equipamentos e formatos (o que importa para pré-impressão)
- Impressoras: **Xerox C70** (laser colorida), **Ricoh 5002** (laser P&B), **Canon TM300** (plotter, contador em m²),
  **Signstar** (ecosolvente, lona/adesivo, ~4,6 m²/h em 360×720), **Epson 5710** (jato de tinta). Plotter de recorte
  (SignMaster PRO).
- Folhas: **SRA3 320×450 mm**, **A3+ / 33×48 = 330×480 mm**, **Formatão 328×478 mm** (padrão quando não se diz a folha),
  A4, A3, ofício 216×330. Papel comprado em **66×96** e cortado (1 folha 66×96 = 9 A4 ou 4 A3+).
- Regras de aproveitamento salvas pelo Juliano: **recorte na plotter** = 10 mm até a borda, **marcas de registro**
  ocupam 25 mm a partir da borda nos 4 cantos, **3 mm entre peças**, sem girar. Sem corte informado → plotter.
  Exemplos conferidos no Formatão: 4×5 cm = 56, 5×5 = 40, 3×5 = 72; 10×5 = 24; 5×15 = 16 (SRA3: 20 e 10).
  A calculadora está em `app/calculos.py` da Júlia (`calcular_aproveitamento`, modo plotter `marca_registro_mm`).
- Comunicação visual: lona 440 g, adesivo Ritrama M80 (1,05 e 1,26 m), perfurado ("Perfurit"), transparente,
  "Retroverso" (transparente com fundo branco), placas PS 2/3 mm e "Placa Leve" PVC expandido 2/3 mm (só placas
  pequenas). Sangria por tipo de mídia fica na calculadora do Sistema Max.

## 4. Regras de preço (resumo; detalhes no CLAUDE.md do Sistema Max)
- Despesas de venda: imposto 10% + cartão 7% + perda 5% = **22%**; lucro meta **33%** → preço = custo ÷ 0,45.
  Comunicação visual: meta 40%, piso 25%. Offset terceirizado: **preço do site × 2 + frete, piso 15%**.
- Valor do minuto de trabalho ≈ **R$ 0,81**; preparação média por pedido 2,5 min. Desconto no Pix 5%; até 3x sem juros.
- A fonte de preço vigente é o **Tiny** e a **Tabela de Preços do Sistema Max** (mesmos preços e SKUs).

## 5. Tiny: como os produtos estão organizados
- Impressões: **um cadastro por faixa de quantidade**, nome padrão
  `Impressão Color Laser A4 Couchê 210g Frente x Verso (TP2 De 21 a 100 un)`; código = base + nº da faixa (266, 2662…).
- Comunicação visual (desde 03/11/2026): **um cadastro por material, vendido em m²** (códigos 6478–6496, unidade M2,
  categoria "Comunicação Visual > Lonas/Adesivos/Placas/Ímãs/Serviços"); quantidade = m² das peças, valor unitário =
  total ÷ m², medidas e acabamento na descrição do item. Tags em PS frente e verso: 6497–6500 (por unidade).
- O Tiny gera o código do produto sozinho na importação (ignora o SKU da planilha).

## 6. Como um sistema novo pode conversar com os que existem
- **Ler/gravar dados do Sistema Max**: pela API do Supabase (`https://drjbbpvmxtejmxxilmey.supabase.co`). Tabelas úteis:
  `price_tables`, `price_table_tiers`, `price_table_categories` (Tabela de Preços), `cv_calc_midias`,
  `cv_calc_impressoes`, `cv_calc_acabamentos` (comunicação visual), `global_settings` (taxas), equipamentos e papéis.
  Multi-empresa: tudo tem `empresa_id` e regras de acesso (RLS). A chave fica em variável de ambiente, nunca no código.
- **Tiny**: API v3 (`https://api.tiny.com.br/public-api/v3`, OAuth). A Júlia já tem a conexão; um sistema novo precisa
  do próprio aplicativo no Tiny (Configurações → Geral → Aplicativos) ou pedir à Júlia.
- **Júlia**: hoje não tem uma API aberta para outros sistemas (só o webhook do WhatsApp e o dashboard). Se o sistema
  novo precisar avisar a equipe pelo WhatsApp, o caminho é criar um endpoint protegido na Júlia (combinar antes).
- Banco de dados: preferir **não criar mais um banco pago**; o Supabase do Sistema Max (plano Free) e o Postgres da
  Júlia (Railway) já existem. Atenção: o Supabase Free **pausa após 7 dias sem uso**.

## 7. Regras de trabalho
- Uma coisa por vez, com OK do Juliano antes de publicar mudanças que afetam a equipe.
- Registrar decisões no `CLAUDE.md` / `docs/HISTORICO.md` do repositório correspondente.
- Não mexer na organização "Sistema GRP" do Supabase. Não editar o Sistema Max pelo Lovable.
