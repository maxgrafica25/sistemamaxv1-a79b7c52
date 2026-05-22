## Objetivo

Permitir cadastrar **produtos recorrentes por cliente** (ex.: "Casa Max — etiquetas 5x3 a cada 20 dias"), com pasta do Drive vinculada, reimpressão em 1 clique, histórico técnico das impressões e lembretes que somem sozinhos quando o pedido novo é gerado.

## Decisões aprovadas

- **Onde fica:** ficha do cliente (`/contatos/:id` nova aba "Recorrentes") + atalho em `/orcamentos-v3/novo` quando o cliente é selecionado.
- **Reimprimir:** dois botões — "Gerar OP direto" e "Gerar orçamento".
- **Histórico técnico:** mini-form rápido (3 campos) que aparece ao marcar OP como "entregue".
- **Lembrete:** notificação na inbox + pequena lista no dashboard. Some assim que um novo orçamento ou pedido for criado referenciando aquele recorrente.

## Modelo de dados

### Nova tabela `client_recurring_products`
- `client_id` → `clients(id)`
- `nome` (ex.: "Etiquetas 5x3 fosca")
- `quote_preset_id` → `quote_presets(id)` (opcional — pega papel/qtd/acabamentos do preset já existente)
- `drive_folder_url` (text — só URL, sem OAuth)
- `frequencia_dias` (int — ex.: 20)
- `aviso_antecedencia_dias` (int default 3 — quando começar a alertar)
- `ultima_impressao_em` (timestamp — atualizado quando OP marcada "entregue")
- `proxima_prevista_em` (date — calculado: ultima + frequencia)
- `observacoes` (text)
- `ativo` (bool default true)
- RLS: authenticated read/write, admin delete.

### Nova tabela `recurring_print_history`
Histórico técnico das impressões.
- `recurring_id` → `client_recurring_products(id)`
- `sales_order_id` → `sales_orders(id)` (opcional — quando veio de uma OP)
- `quote_id` → `quotes(id)` (opcional — quando veio de orçamento)
- `equipment_id` → `equipments(id)` (select do form rápido)
- `carga_cor` (text — campo curto: "Padrão", "Reduzida 10%", etc.)
- `observacoes` (text — anotação livre)
- `impresso_em` (timestamp)
- `operador_id` → `auth.users(id)`
- RLS authenticated read/insert; admin update/delete.

### Lembrete pendente
Em vez de criar nova tabela de lembretes, **reaproveitar `notifications`** com `source_type = 'recurring_due'` e `source_id = recurring_id`. Uma notificação por recorrente "vencendo".

### Como o aviso some sozinho
Trigger `AFTER INSERT` em `quotes` e `sales_orders` que olha `client_id`:
- Procura `client_recurring_products` ativos do cliente com `proxima_prevista_em <= today + aviso_antecedencia_dias`.
- Se o orçamento/pedido foi criado com `metadata->>'recurring_id'` apontando pra um deles (ou se o usuário marcou no fluxo), marca o lembrete como lido e arquiva.
- Heurística auxiliar: se nenhuma vinculação explícita, mas o cliente bate, oferece um toast "Vincular este pedido ao recorrente X?".

## Fluxo de uso

### Cadastro (na ficha do cliente, aba "Recorrentes")
Card simples por linha. Botão "+ Novo recorrente" abre dialog:
- Nome do produto
- Preset (select dos `quote_presets` já existentes — opcional)
- URL da pasta Google Drive
- Frequência em dias
- Quando avisar (X dias antes)

### Atalho em `/orcamentos-v3/novo`
Quando o cliente é escolhido e ele tem recorrentes, aparece um painel acima dos chips de preset:
> **Compras recorrentes deste cliente**
> [📦 Etiquetas 5x3 — última há 18 dias] [📁 Drive] [Gerar OP] [Gerar orçamento]

Clicar "Gerar OP" ou "Gerar orçamento" preenche tudo, vincula o `recurring_id` no metadata e o lembrete some.

### Após entregar a OP
Modal de 3 campos aparece ao mudar status para "entregue":
- Equipamento (select de `equipments`)
- Carga de cor (input curto, com sugestões: "Padrão", "Reduzida", "Aumentada")
- Observação (textarea opcional)

Salva em `recurring_print_history` + atualiza `ultima_impressao_em` no recorrente.

### Histórico
Na ficha do recorrente, timeline simples: data → equipamento → carga → observação → quem operou. Filtro por equipamento.

### Dashboard
Card "Recorrentes vencendo" no dashboard com lista compacta (sem botões de ação — só link "Ver na ficha do cliente", respeitando a regra do dashboard). Some o card quando lista vazia.

## Componentes novos

- `src/pages/contatos/[id]/RecorrentesTab.tsx`
- `src/components/recorrentes/RecorrenteFormDialog.tsx`
- `src/components/recorrentes/RecorrentesPanel.tsx` (usado em `/orcamentos-v3/novo`)
- `src/components/recorrentes/PostPrintDialog.tsx` (form rápido pós-impressão)
- `src/components/recorrentes/PrintHistoryTimeline.tsx`
- `src/components/dashboard/RecorrentesVencendoCard.tsx`
- `src/hooks/useClientRecurring.ts`

## Hooks de backend

- Trigger em `sales_orders` para status change → quando vira "entregue", abre o `PostPrintDialog` no frontend (controlado por flag no metadata).
- Trigger em `quotes`/`sales_orders` para arquivar lembrete vinculado.
- Cron diário (job em `pg_cron`, padrão do projeto) que recalcula `proxima_prevista_em` e enfileira notificação para cada recorrente que entrou na janela de aviso e ainda não tem notificação aberta.

## Fora de escopo (proposta de v2)

- Integração OAuth com Drive para preview/seleção de arquivos dentro do app.
- Auto-aprendizado de frequência (detectar sozinho que o cliente sempre pede a cada X dias).
- Reimpressão em lote (vários recorrentes vencendo de uma vez).

## Validação

1. Ficha do cliente → aba "Recorrentes" → cadastrar um produto com frequência 20 dias e pasta Drive.
2. Abrir Drive funciona (nova aba).
3. Esperar/forçar a notificação aparecer na inbox + card no dashboard.
4. Clicar "Gerar OP" no atalho do orçamento → cria OP com cliente e preset corretos; lembrete some.
5. Marcar OP como "entregue" → mini-form aparece, salva equipamento+carga+obs, timeline atualiza.
6. Próxima previsão recalculada para +20 dias.