
# Engagement Tracking V2 — Documento Final Consolidado

> **Especificação travada.** Esta é a versão definitiva. Implementação não deve desviar dos pontos de atenção crítica listados ao final.

---

## 1. Migration — schema completo

```sql
-- Tabela de eventos
create table public.quote_engagement_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  event_type text not null check (event_type in
    ('viewed','printed','whatsapp_share','link_copied',
     'option_selected','scroll_depth')),
  metadata jsonb not null default '{}'::jsonb,
  -- metadata: { device_type, os, browser, location_hint?,
  --             option_id?, option_label?, scroll_pct?, visit_number? }
  user_agent text,
  ip_hash text,                  -- preparado p/ futura edge function geo
  created_at timestamptz not null default now()
);
create index on public.quote_engagement_events (quote_id, created_at desc);
create index on public.quote_engagement_events (quote_id, event_type);

alter table public.quote_engagement_events enable row level security;

create policy "Authenticated read engagement"
  on public.quote_engagement_events for select to authenticated using (true);
-- Sem policy de INSERT: anon escreve apenas via RPC SECURITY DEFINER

alter publication supabase_realtime add table public.quote_engagement_events;

-- Persistir telefone do cliente no orçamento
alter table public.quotes add column if not exists client_phone text;
```

---

## 2. RPC `register_quote_event`

Filtro **rigoroso** de equipe + cálculo de `visit_number` (re-acesso) + `location_hint` preparado.

```sql
create or replace function public.register_quote_event(
  p_quote_id   uuid,
  p_event_type text,
  p_metadata   jsonb default '{}'::jsonb,
  p_user_agent text default null,
  p_visitor_id text default null   -- ID estável do navegador (localStorage)
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_visit_number int := 1;
  v_meta jsonb;
begin
  -- ATENÇÃO CRÍTICA: filtro rigoroso da equipe
  if v_uid is not null then return; end if;

  if p_event_type not in
     ('viewed','printed','whatsapp_share','link_copied',
      'option_selected','scroll_depth')
  then raise exception 'invalid event_type'; end if;

  v_meta := coalesce(p_metadata, '{}'::jsonb);

  -- Re-acesso: conta quantas vezes este visitor já abriu este orçamento
  if p_event_type = 'viewed' and p_visitor_id is not null then
    select count(distinct date_trunc('hour', created_at))::int + 1
      into v_visit_number
      from public.quote_engagement_events
     where quote_id = p_quote_id
       and event_type = 'viewed'
       and metadata->>'visitor_id' = p_visitor_id;
    v_meta := v_meta
      || jsonb_build_object('visit_number', v_visit_number)
      || jsonb_build_object('visitor_id', p_visitor_id);
  end if;

  -- Garante chave location_hint sempre presente (null por enquanto)
  v_meta := jsonb_set(v_meta, '{location_hint}',
              coalesce(v_meta->'location_hint','null'::jsonb), true);

  insert into public.quote_engagement_events
    (quote_id, event_type, metadata, user_agent)
  values (p_quote_id, p_event_type, v_meta, p_user_agent);

  if p_event_type = 'viewed' then
    update public.quotes
       set view_count = coalesce(view_count,0)+1,
           last_viewed_at = now()
     where id = p_quote_id;
  end if;
end; $$;

grant execute on function public.register_quote_event(uuid,text,jsonb,text,text)
  to anon, authenticated;
```

> `visitor_id` = UUID gerado uma vez no cliente, salvo em `localStorage` (`qv2_visitor`). Permite distinguir "5ª visita do mesmo cliente" sem armazenar IP cru.

---

## 3. Helpers (`src/lib/quotes-v2/`)

### `tracking.ts`

```ts
function getVisitorId(): string {
  let v = localStorage.getItem('qv2_visitor');
  if (!v) {
    v = crypto.randomUUID();
    localStorage.setItem('qv2_visitor', v);
  }
  return v;
}

function parseUA() { /* device_type, os, browser */ }

export async function trackEvent(
  quoteId: string,
  eventType: EventType,
  extra: Record<string, unknown> = {},
) {
  if (eventType === 'viewed') {
    const k = `qv2_view_${quoteId}`;
    const last = Number(sessionStorage.getItem(k) || 0);
    if (Date.now() - last < 30_000) return;
    sessionStorage.setItem(k, String(Date.now()));
  }
  await supabase.rpc('register_quote_event', {
    p_quote_id: quoteId,
    p_event_type: eventType,
    p_metadata: { ...parseUA(), ...extra },
    p_user_agent: navigator.userAgent.slice(0, 500),
    p_visitor_id: getVisitorId(),
  });
}
```

### `useScrollDepthTracking.ts` — hook

**Atenção crítica**: listener `passive: true`, dispara **1x por sessão** via `sessionStorage`.

```ts
export function useScrollDepthTracking(quoteId: string | undefined) {
  useEffect(() => {
    if (!quoteId) return;
    const key = `qv2_scroll_${quoteId}`;
    if (sessionStorage.getItem(key)) return;

    let fired = false;
    const onScroll = () => {
      if (fired) return;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = total > 0 ? (scrolled / total) * 100 : 0;
      if (pct >= 90) {
        fired = true;
        sessionStorage.setItem(key, '1');
        trackEvent(quoteId, 'scroll_depth', { scroll_pct: Math.round(pct) });
        window.removeEventListener('scroll', onScroll);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [quoteId]);
}
```

### `temperature.ts`

```ts
export type Temperature = 'cold' | 'warm' | 'hot' | 'live';
export interface EngagementStats {
  viewCount: number;
  printedCount: number;
  sharedCount: number;
  copiedCount: number;
  scrolledFully: boolean;
  lastEventAt: Date | null;
  favoriteOption?: { id: string; label: string; count: number };
  events: EngagementEvent[];      // últimos 15
}

export function computeTemperature(s: EngagementStats): Temperature {
  if (s.lastEventAt && Date.now() - s.lastEventAt.getTime() < 10*60_000) return 'live';
  if (s.printedCount > 0 || s.sharedCount > 0 || s.viewCount >= 3) return 'hot';
  if (s.viewCount >= 1) return 'warm';
  return 'cold';
}
```

---

## 4. `EngagementBadge.tsx`

| Temp | Label | Classes | Ícone |
|---|---|---|---|
| `cold` | "Frio" | `bg-muted text-muted-foreground` | `Snowflake` |
| `warm` | "Interesse" | `bg-blue-500/15 text-blue-700 border-blue-300` | `Eye` |
| `hot` | "Quente" | `bg-green-500/15 text-green-700 border-green-300` | `Flame` |
| `live` | "Online agora" | `bg-orange-500/15 text-orange-700 border-orange-300` + **dot brilhante** + pulse | `Radio` |

**Polimento UX — dot brilhante para `live`** (estilo "online" do Instagram):

```tsx
{temp === 'live' && (
  <span className="relative flex h-2 w-2 mr-1">
    <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75 animate-ping" />
    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
  </span>
)}
```

---

## 5. `EngagementPopover.tsx`

Lazy-load (busca eventos só ao abrir).

```text
┌──────────────────────────────────────┐
│ ● 🔥 Quente · Última: há 4 min       │
│ ────────────────────────────────────│
│ 👁 7   🖨 2   📱 1   🔗 3            │
│                                      │
│ ⭐ Opção preferida: "Opção B"        │
│    (selecionada 4x)                  │
│                                      │
│ ✓ Leu a proposta integralmente       │
│                                      │
│ Atividade recente                    │
│ ────────────────────────────────────│
│ • Hoje 10:15  Visualizou (5ª vez)    │
│   Android · Chrome                   │
│ • Hoje 10:14  Selecionou Opção B     │
│ • Ontem 18:30 Baixou PDF             │
│   Windows · Edge                     │
│ • 26/04 09:12 Visualizou (1ª vez)    │
│ ... (até 15)                         │
│ ────────────────────────────────────│
│ [ 💬 WhatsApp follow-up ]   ← hot/live + telefone
│ [ 🔗 Copiar link ]                  │
└──────────────────────────────────────┘
```

**Re-acesso**: cada `viewed` mostra `metadata.visit_number` → "Visualizou (5ª vez)".

**Mensagens WhatsApp follow-up — exatas (não alterar)**:

```ts
function buildFollowUpMsg(
  t: 'hot' | 'live',
  clientName: string,
  quoteNumber: string,
  fav?: string,
): string {
  const greeting = `Oi ${clientName.split(' ')[0]}!`;
  if (t === 'live') {
    return `${greeting} Vi que você está com a proposta ${quoteNumber} aberta agora. Posso esclarecer alguma dúvida em tempo real?`;
  }
  // hot
  const favPart = fav ? ` Notei seu interesse na ${fav}.` : '';
  return `${greeting} Tudo bem? Estou passando pra saber se conseguiu analisar nossa proposta ${quoteNumber}.${favPart} Posso ajudar com algo?`;
}
```

Abre `https://wa.me/<digits-only>?text=<encodeURIComponent(msg)>` em nova aba.

---

## 6. Lista `OrcamentosV2.tsx`

**Pré-busca agregada** (1 query):
```ts
const { data: events } = await supabase
  .from('quote_engagement_events')
  .select('quote_id, event_type, metadata, created_at')
  .order('created_at', { ascending: false })
  .limit(2000);
```

Reduzir client-side em `Map<quote_id, EngagementStats>`.

**Filtro de Temperatura — reativo e combinável com Status (AND)**:

```text
[ Status ▾ ]    [ Temperatura ▾ ]
                ├ Todas
                ├ 🟠 Online agora (live)
                ├ 🔥 Quentes (hot + live)
                ├ 🔵 Interesse (warm)
                └ ⚪ Frios (cold)
```

`useMemo` recalcula `filtered` quando `search`, `statusFilter` ou `tempFilter` mudam.

Substituir badge atual (linhas 213-225) por `<EngagementPopover ... />` envolvendo o `<EngagementBadge>`.

---

## 7. Disparos no viewer

| Evento | Onde | Detalhe |
|---|---|---|
| `viewed` | `useEffect` no `ClientViewer` | substitui `register_quote_view`; throttle 30s |
| `printed` | Botão "Baixar PDF" no `ViewerHeader` | sem throttle |
| `whatsapp_share` | `onClick` nos `<a>` de Aprovar/Solicitar Alteração no `StickyApprovalBar` | dispara antes de navegar |
| `link_copied` | **Novo** botão "Copiar link" no `ViewerHeader` | sem throttle |
| `option_selected` | `setSelectedOptionId` com debounce 2s | metadata: `{ option_id, option_label }` |
| `scroll_depth` | Hook `useScrollDepthTracking` | 1x por sessão, listener passive |

---

## 8. RealtimeRadar — toasts de alta intenção

- Inscrever `INSERT` em `quote_engagement_events`
- Toast só para `printed` e `whatsapp_share`
- Cache `Map<quote_id, { client, quote_number }>` populado on-demand
- Throttle 60s por `(quote_id, event_type)`
- Mensagem: `🔥 Cliente João acaba de baixar o PDF do Orçamento 2026-042`
- Sem toast para `viewed` / `scroll_depth`

---

## ⚠️ Pontos de atenção crítica

1. **RPC `register_quote_event`**: `if v_uid is not null then return; end if;` é **obrigatório** logo no início — eventos da equipe interna jamais podem ser registrados.
2. **Hook `useScrollDepthTracking`**: listener com `{ passive: true }` e flag em `sessionStorage` para garantir 1 disparo único por sessão. Cleanup remove o listener.
3. **Mensagens de follow-up no WhatsApp**: usar literalmente as duas strings da seção 5. Não reescrever.
4. **Filtro de Temperatura**: combinar via AND com filtro de Status. Recálculo via `useMemo([search, statusFilter, tempFilter, quotes, statsMap])`.
5. **Polimento `live`**: o badge deve ter o dot pulsante (animate-ping) **além** do pulse no badge. Visual de "Online" do Instagram.
6. **Re-acesso**: `metadata.visit_number` calculado no servidor a partir do `visitor_id` do localStorage. Mostrar "(Nª vez)" em cada `viewed` na timeline.

---

## Arquivos afetados

**Novos**:
- `supabase/migrations/<ts>_quote_engagement_events.sql`
- `src/lib/quotes-v2/tracking.ts`
- `src/lib/quotes-v2/temperature.ts`
- `src/lib/quotes-v2/useScrollDepthTracking.ts`
- `src/components/orcamentos-v2/EngagementBadge.tsx`
- `src/components/orcamentos-v2/EngagementPopover.tsx`

**Editados**:
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — pré-busca, filtro de temperatura, novo badge/popover
- `src/pages/orcamentos-v2/ClientViewer.tsx` — `trackEvent` + hook de scroll + `option_selected`
- `src/components/orcamentos-v2/client-viewer/ViewerHeader.tsx` — botões "Baixar PDF" e "Copiar link"
- `src/components/orcamentos-v2/client-viewer/StickyApprovalBar.tsx` — `onClick` p/ `whatsapp_share`
- `src/components/orcamentos-v2/RealtimeRadar.tsx` — canal de eventos + toasts hot
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — salvar `client_phone` ao criar

Pronto para implementar quando aprovar.
