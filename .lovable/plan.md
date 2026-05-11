## Problema

Hoje, quando o cliente aprova itens pelo viewer público, o sistema:
- Atualiza o status do orçamento (`pending` → `partial` → `approved`).
- **NÃO dispara nenhuma notificação interna.**

Resultado: a primeira aprovação parcial deixa o status como "Parcial". Se 3 dias depois o cliente aprovar mais um item, o status continua "Parcial" e ninguém é avisado — a equipe só descobre se entrar no orçamento.

A função `notifications` (sininho do header) já existe e já é usada pelo monitor de preços. Falta apenas conectar o fluxo de aprovação a ela.

## O que muda

### 1. Notificação a cada nova aprovação (parcial ou total)

Estender a função `approve_quote_items` para, ao final, criar uma `notifications` por usuário ativo — **toda vez** que itens forem aprovados, não só na primeira.

Conteúdo da notificação:
- **Título:** `Novo aceite — Orçamento Nº {numero}` (parcial) ou `Orçamento Nº {numero} aprovado integralmente` (quando passa para `approved`).
- **Mensagem:** `{Cliente} aprovou {N} item(ns): {títulos resumidos}. Total acumulado aprovado: R$ X.XXX,XX ({M de T itens}).`
- **Tipo:** `success` quando vira `approved`; `info` quando é parcial subsequente.
- **source_type:** `quote_approval`; **source_id:** id do orçamento (clicar no sininho leva para `/orcamentos-v2?focus={id}` — ver item 3).

A função recebe os itens recém-aprovados, então conseguimos listar exatamente o que foi aceito nessa rodada — exatamente o que faltou no caso do 2026-011.

### 2. Realtime já cobre a UI

A tabela `notifications` já está no `supabase_realtime`. O sininho (`NotificationBell`) já escuta inserts. Nenhuma mudança de frontend é necessária para o aviso aparecer em tempo real para todos os usuários logados.

### 3. (Opcional) Destaque na lista de orçamentos

Em `OrcamentosV2.tsx`, ao clicar na notificação, abrir a página com `?focus={quoteId}` e dar um highlight temporário (ring + scrollIntoView) na linha. Isso ajuda o operador a achar o orçamento entre dezenas. Se preferir simplificar, podemos pular esse item agora.

## Arquivos afetados

- **Nova migration:** redefine `public.approve_quote_items(p_quote_id uuid, p_item_ids uuid[])` para também inserir em `public.notifications` ao final, iterando sobre `profiles.user_id`. Usa o `quote_number`, `client` (de `quotes`) e os `description` dos itens efetivamente aprovados nessa chamada (filtrando por `id = ANY(p_item_ids) AND status = 'aprovado'` após o UPDATE). Calcula contagem total aprovada vs total de itens raiz.
- **Sem mudança no frontend de aprovação** (`ClientViewer.tsx`) — a RPC continua sendo chamada igual.
- **(Opcional)** `src/components/NotificationBell.tsx` + `src/pages/orcamentos-v2/OrcamentosV2.tsx`: navegação com `?focus=` e highlight de linha.

## Detalhes técnicos

- Mantém `SECURITY DEFINER` e `search_path = public` (a RPC é chamada por usuário **anônimo** via viewer público — por isso o INSERT em `notifications` precisa rodar como definer; o trigger de `handle_tier_price_change` já segue esse padrão).
- O array de descrições é truncado se passar de ~3 itens (`"Cartão de visita, Folder e mais 2"`) para caber bem no toast/sininho.
- Não cria notificações se `v_count = 0` (nenhum item foi efetivamente aprovado, ex.: clique duplicado).

## Fora de escopo

- E-mail/WhatsApp para a equipe (apenas inbox + sininho).
- Re-notificar quando cliente apenas visualiza/recusa.