# Engagement Tracking V2 — Consolidação Final

A maior parte da infraestrutura já está no ar (tabela `quote_engagement_events`, RPC com filtro de equipe, badge de temperatura, popover, scroll depth, radar realtime, filtro de temperatura). Este plano fecha os **gaps** da especificação completa: hesitação, encaminhamento (multi-visitor), `ip_hash`, badge de leitura integral e refinos de UX. Sem retrabalho do que já funciona.

## 1. Banco de dados (1 migration)

- Recriar a RPC `register_quote_event` com:
  - `option_deselected` adicionado ao `CHECK` de event_types.
  - Cálculo de `ip_hash` server-side: `encode(digest(inet_client_addr()::text || quote_id::text, 'sha256'), 'hex')` (precisa `pgcrypto`, já vem habilitado). Salvo na coluna `ip_hash` que já existe.
  - Manter filtro crítico `IF auth.uid() IS NOT NULL THEN RETURN`.
  - Manter `visit_number` e `location_hint` como já estão.

## 2. Tracking client-side

**`src/lib/quotes-v2/tracking.ts`**
- Adicionar `"option_deselected"` ao tipo `EngagementEventType`.

**`src/pages/orcamentos-v2/ClientViewer.tsx`** — rastrear hesitação por item:
- Substituir o tracking de "opção" pelo de **item individual** (que é o que realmente importa hoje, já que aprovação é por item).
- No `toggleItem(itemId)`:
  - Manter `Map<itemId, timeoutId>` em `useRef`.
  - Ao **marcar**: `setTimeout(2000)` → dispara `option_selected` com `{ option_id: itemId, option_label: item.description }`.
  - Ao **desmarcar antes de 2s** sem ter disparado `selected`: cancela timeout, nada vai pro banco.
  - Ao **desmarcar depois de 2s** (já registrou selected): novo `setTimeout(2000)` → dispara `option_deselected` com mesmo metadata.
- Remover/manter compatível o effect atual de `selectedOptionId` (continua válido para orçamentos com múltiplas opções de quantidade).

## 3. Lógica de inteligência

**`src/lib/quotes-v2/temperature.ts`**
- Estender `EngagementStats`:
  ```ts
  hesitatedItems: Array<{ id: string; label: string; cycles: number }>;
  forwarded: boolean;          // 2+ visitor_ids distintos
  distinctVisitors: number;
  ```
- `buildStatsMap`:
  - Pareia `option_selected` + `option_deselected` por `option_id` → conta `cycles` por item, mantém top 5 ordenado desc.
  - Conta `distinctVisitors` via `metadata.visitor_id` em eventos `viewed`. `forwarded = distinctVisitors >= 2`.
- `computeTemperature`: bumpar para **hot** quando houver `hesitatedItems.length > 0` **ou** `forwarded === true` (sinais de alta intenção, conforme spec).

## 4. UI no popover

**`src/components/orcamentos-v2/EngagementPopover.tsx`** — adicionar entre Insights e Timeline:
- **Hesitação** (se `hesitatedItems.length > 0`): ícone âmbar `AlertTriangle` + `"Cliente demonstrou dúvida em '{label}' (marcou e desmarcou {cycles}x)"`.
- **Encaminhamento** (se `forwarded`): ícone azul `Send` + `"Proposta encaminhada — acessada por {distinctVisitors} dispositivos"`.
- **Leitura integral** (se `scrolledFully`): já existe, manter.
- Timeline: novo `eventLabel` para `option_deselected` → `"Desmarcou {option_label}"`.
- Mensagens de WhatsApp: **sem alterações** (mantém as duas contextuais já aprovadas para hot/live).

## 5. Lista de orçamentos

**`src/pages/orcamentos-v2/OrcamentosV2.tsx`**
- O filtro de temperatura já existe. Garantir que combina via **AND** com o filtro de status no `useMemo` de `filteredQuotes` (verificar e ajustar se necessário).
- Sem mudanças visuais adicionais.

## 6. Realtime Radar

Sem mudanças. Já dispara toasts 🔥 apenas para `printed` e `whatsapp_share`, com throttle de 60s. `option_deselected` **não** vira toast (evita spam).

## Detalhes técnicos

- **Hesitação conservadora**: debounce de 2s (alinhado ao spec). Marcar/desmarcar em <2s = zero eventos.
- **ip_hash**: SHA-256 de `IP + quote_id` (não reversível, não identifica pessoa, mas permite agrupar acessos do mesmo IP por orçamento).
- **forwarded**: usa `visitor_id` (cookie), não IP — captura encaminhamento real (cliente mandou pro sócio), não troca de wifi.
- **Compat**: estatísticas existentes (viewCount, printedCount etc.) ficam intactas; apenas estendemos.
- **RLS**: `quote_engagement_events` já está protegida; a RPC continua `SECURITY DEFINER` com filtro de equipe.

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — RPC atualizada (option_deselected + ip_hash)
- `src/lib/quotes-v2/tracking.ts` — novo event type
- `src/lib/quotes-v2/temperature.ts` — hesitação + forwarded + bump de temperatura
- `src/components/orcamentos-v2/EngagementPopover.tsx` — duas novas seções de insight + label do timeline
- `src/pages/orcamentos-v2/ClientViewer.tsx` — debounce de marcação/desmarcação por item
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — confirmar AND temperatura+status

## Checklist de entrega

- [x] Equipe logada ignorada (RPC já filtra `auth.uid()`).
- [x] WhatsApp aparece só com telefone + status hot/live (já implementado).
- [x] Contador "nª vez" (já implementado via `visit_number`).
- [ ] Filtro temperatura × status combinando reativamente (validar nesta entrega).
- [ ] Hesitação detectada e exibida.
- [ ] Encaminhamento detectado e exibido.
- [ ] `ip_hash` populado nos novos eventos.
