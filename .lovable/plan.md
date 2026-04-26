## Orçamentos V2 — Sandbox A/B paralelo à V1 (revisado)

Versão final aprovada com os 3 ajustes críticos: WhatsApp via env/constante, recálculo real na ancoragem, RLS por UUID e OP mockada.

V1 em `/orcamentos` permanece **100% intocada**. Toda a V2 vive em diretórios isolados e em rotas novas.

---

### 1. Banco de dados (migration aditiva, não-destrutiva)

```sql
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS view_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS discount_value numeric,
  ADD COLUMN IF NOT EXISTS discount_type text,        -- 'percent' | 'brl'
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS is_template boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS options jsonb;             -- variações de ancoragem
```

Demais ajustes de DB:
- **RPC `register_quote_view(quote_id uuid)`** com `SECURITY DEFINER` — única forma de o anon escrever no tracking.
- **RLS pública (segurança por obscuridade aprovada)**: policies `SELECT` para o role `anon` em `quotes`, `quote_labor_steps`, `quote_materials`, `quote_third_party` (sem listar — sempre filtrado por id pelo cliente).
- **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.quotes;` se ainda não estiver.
- **Sem mexer em `global_settings`** (ver item 6).

---

### 2. Estrutura de arquivos (V1 intocada)

```text
src/pages/orcamentos-v2/
  OrcamentosV2.tsx            # /orcamentos-v2
  NewQuoteV2.tsx              # /orcamentos-v2/novo
  EditQuoteV2.tsx             # /orcamentos-v2/:id
  ClientViewer.tsx            # /view-quote/:id (público)

src/components/orcamentos-v2/
  QuoteListV2.tsx
  NewQuoteFormV2.tsx
  StickyFinancialSidebar.tsx
  DiscountPaymentBlock.tsx
  QuoteOptionsBuilder.tsx
  RealtimeRadar.tsx
  CloneQuoteButton.tsx
  GenerateOPButton.tsx        # mock: console.log + toast
  client-viewer/
    OptionCard.tsx
    StickyApprovalBar.tsx
    ViewerHeader.tsx

src/lib/quotes-v2/
  whatsapp.ts                 # número centralizado + builders
  options.ts                  # tipos + helpers JSONB
  margin.ts                   # cálculo + cor do semáforo
  pricing.ts                  # função pura de recálculo por quantidade
```

`App.tsx` só **adiciona** rotas:
- `/orcamentos-v2`, `/orcamentos-v2/novo`, `/orcamentos-v2/:id` (protegidas)
- `/view-quote/:id` (pública, fora do `<ProtectedRoute>`)

---

### 3. Página pública `/view-quote/:id`

Mobile-first, fundo claro, espaçamento generoso, tipografia ≥16px.

- **Header**: logo + `Orçamento Nº` + cliente + validade.
- **Resumo comercial** (sem custos internos).
- **Ancoragem (`options.length >= 2`)**: cards de seleção exibindo *quantidade*, *valor unitário* e *valor total* já recalculados (ver item 5). Clique ativa borda primária + check e habilita CTAs.
- **Bloco de pagamento + desconto** se preenchidos.
- **Sticky footer**:
  - Verde **"✅ Aprovar Orçamento"** → `wa.me/<numero>?text=...` com nº + opção escolhida.
  - Outline **"Solicitar Alteração"** → wa.me com mensagem de ajuste.
- **Tracking silencioso**: `useEffect` chama `supabase.rpc('register_quote_view', { quote_id })`. Sem feedback visual.
- **Estados**: loading skeleton, não encontrado, aprovado/recusado (mantém botão de contato).

---

### 4. Listagem `/orcamentos-v2` + Radar Realtime

- Reusa query da V1 + novas colunas.
- Linhas mostram badges atuais + **"👁 Visto Xx"** se `view_count > 0` + **"Template"** se `is_template`.
- Ações: WhatsApp, PDF, **Clonar**, **Salvar como Template**, **Gerar OP** (approved), Aprovar/Recusar.
- **`<RealtimeRadar/>`** montado uma vez:
  - Subscribe `postgres_changes` UPDATE em `quotes`.
  - Mudança de `last_viewed_at` → `toast()`: *"👀 Cliente {client} está visualizando o Orçamento {nº} agora!"*
  - Throttle 30s por orçamento.
- **Clonar**: novo registro, próximo `quote_number`, copia child rows, status `pending`, zera tracking.
- **Salvar como Template**: `is_template = true` + filtro "Templates".
- **Gerar OP (mock aprovado)**: monta payload completo (cliente, itens, mão de obra, terceirizados), `console.log(payload)` + `toast.success("OP gerada com sucesso (mock)")`. Estrutura pronta para integração futura.

---

### 5. Wizard V2 — `NewQuoteFormV2`

**Sticky Financial Sidebar** nos passos 1–3:
- Desktop: lateral direita `lg:sticky lg:top-4`, ~320px.
- Mobile: barra inferior fixa expansível.
- Mostra Custo Total, Valor a Cobrar, Margem %, Lucro R$.

**Semáforo de margem**:
- `< 15%` vermelho + alerta · `15–25%` amarelo · `> 25%` verde.

**Step 4 (Finalizar)**:
- **DiscountPaymentBlock**: input de desconto + toggle `R$ / %`, recálculo ao vivo.
- Select **Forma de pagamento**: Pix, Dinheiro, Boleto, Cartão à vista, Cartão 2x–6x, Transferência.
- **QuoteOptionsBuilder** — **CORREÇÃO CRÍTICA aplicada**:
  - **NÃO** multiplica `unitPrice * novaQty`.
  - Cada variação dispara `recalculateForQuantity(newQty)` em `src/lib/quotes-v2/pricing.ts`, função pura que reaplica toda a lógica original do orçamento:
    - Para cada item de impressão: refaz `findTier(categoryId, newQty, markupGroupId)` (a faixa de markup muda) e `calcSellingPrice(baseCost, tier)` — preço unitário cai com volume.
    - Custos fixos de mão de obra e terceirizados se **diluem** no novo total (mesmo absoluto, distribuído por mais unidades).
    - Materiais consumíveis escalam linearmente, mas o markup recalculado pela tier corrige o preço final.
    - Aplica imposto/perda/cobrança/margem com o mesmo divisor da V1.
  - Resultado salvo em `options[]`: `{ id, label, quantity, unit_price, total }` com unit_price já correto para aquela faixa.
  - UI mostra os deltas: *"500un: R$ X / un · 1.000un: R$ Y / un (-Z%)"* para validar visualmente o efeito de escala.
- Link compartilhável `/view-quote/:id` com botão copiar.

---

### 6. WhatsApp centralizado (sem dependência de `global_settings`)

`src/lib/quotes-v2/whatsapp.ts`:

```ts
// Fonte única do número da gráfica.
// Pode ser sobrescrito por env var no deploy; fallback hardcoded.
const PHONE = import.meta.env.VITE_WHATSAPP_NUMBER ?? "5511999999999";

export const buildWaUrl = (msg: string) =>
  `https://wa.me/${PHONE.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;

export const buildApprovalMessage = (p: { quoteNumber: string; optionLabel?: string }) =>
  `Olá! Analisei o Orçamento ${p.quoteNumber}` +
  (p.optionLabel ? `, escolhi a opção de ${p.optionLabel}` : "") +
  ` e APROVO a produção conforme os detalhes enviados.`;

export const buildAdjustMessage = (p: { quoteNumber: string }) =>
  `Olá! Vi o Orçamento ${p.quoteNumber}, mas gostaria de solicitar um ajuste. Podemos falar?`;
```

Trocar o número = editar uma constante. Sem migration, sem quebra.

---

### 7. Detalhes técnicos

- Tipagem `options`: `{ id: string; label: string; quantity: number; unit_price: number; total: number }`.
- Realtime channel: `quotes-radar-v2`, cleanup no unmount.
- RLS pública estrita ao `SELECT` filtrado por id (UUID não-enumerável).
- Acessibilidade AA, `aria-label` nos CTAs, contraste validado.
- `pricing.ts` é função **pura** — recebe snapshot do orçamento + qty, devolve totais. Reusa fórmulas idênticas à V1 (sem duplicar regra de negócio divergente).

---

### 8. Ordem de execução

1. Migration aditiva + RPC + RLS pública + realtime publication.
2. `src/lib/quotes-v2/*` (whatsapp, pricing, margin, options).
3. Esqueleto de rotas e páginas V2 vazias.
4. `ClientViewer` + tracking + WhatsApp.
5. `OrcamentosV2` + Clonar + Template + Gerar OP (mock) + RealtimeRadar.
6. `NewQuoteFormV2` (cópia adaptada da V1) + Sticky sidebar + Semáforo.
7. Step 4: Desconto, Pagamento, QuoteOptionsBuilder usando `recalculateForQuantity`.
8. QA mobile (394px) + desktop, smoke test do realtime entre duas abas.
