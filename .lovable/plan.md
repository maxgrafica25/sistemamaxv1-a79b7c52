## Motor de Orçamentos — Comunicação Visual (V2)

Novo módulo de orçamento de grande formato (lona, adesivo, chapa) integrado ao Orçamentos V2 atual. Cliente, desconto, aprovação, PDF e WhatsApp continuam compartilhados — muda só como o item é montado e precificado.

### 1. Banco de dados (Supabase + RLS padrão)

Quatro tabelas novas em `public`. RLS no padrão do projeto: leitura para `authenticated`, escrita restrita a `is_profile_admin(auth.uid())` (cv_quote_items segue a permissão de quotes — qualquer autenticado).

**`cv_materials`**
- `id uuid pk`, `nome text`, `categoria text check in ('lona','adesivo','chapa','outro')`
- `largura_util_cm numeric`, `custo_mt2 numeric`, `margem_mt2_pct numeric default 0`
- `valor_minimo numeric default 0`, `is_active bool default true`, `sort_order int`
- `created_at`, `updated_at`

**`cv_printers`**
- `id`, `nome`, `tecnologia text` (solvente | eco-solvente | UV | latex | outro)
- `largura_max_cm numeric`, `custo_mt2_print numeric`, `margem_mt2_print_pct numeric default 0`
- `custo_fixo_setup numeric default 0`, `lucro_fixo_setup numeric default 0`
- `categorias_compativeis text[] default '{}'`, `is_active bool`, `sort_order int`

**`cv_finishes`**
- `id`, `nome`, `categoria_compativel text[] default '{}'`
- `tipo_calculo text check in ('unidade','mt2','perimetro_metro','fixo')`
- `custo numeric`, `margem_pct numeric default 0`, `is_active bool`, `sort_order int`

**`cv_quote_items`**
- `id`, `quote_id uuid references quotes(id) on delete cascade`
- `material_id`, `printer_id` (referências sem on-delete em cascata — viram null se cadastro for apagado)
- `largura_cm numeric`, `altura_cm numeric`, `quantidade int default 1`
- `area_total_m2 numeric` (gerada/calculada no client e persistida)
- `tem_emenda bool default false`, `aplicou_minimo bool default false`
- `finishes_json jsonb default '[]'` (lista `{finish_id, nome, tipo_calculo, qtd_calculada, valor}`)
- `preco_midia numeric`, `preco_impressao numeric`, `preco_acabamentos numeric`, `preco_total numeric`
- `sort_order int`, `created_at`

Triggers `updated_at` reaproveitando `public.update_updated_at_column()`.

### 2. Engine de cálculo — `src/lib/cv-pricing/engine.ts`

Função pura `calcularItemCV(input) → resultado`, sem efeitos colaterais. Usado pelo card reativo e na hora de salvar.

```text
area_m2     = (largura_cm * altura_cm / 10000) * quantidade
tem_emenda  = largura_cm > printer.largura_max_cm

preco_midia      = area_m2 * material.custo_mt2 * (1 + material.margem_mt2_pct/100)
preco_impressao  = area_m2 * printer.custo_mt2_print * (1 + printer.margem_mt2_print_pct/100)
                 + printer.custo_fixo_setup + printer.lucro_fixo_setup

para cada acabamento aplicado:
  unidade         → custo * quantidade
  mt2             → custo * area_m2
  perimetro_metro → custo * ((largura_cm*2 + altura_cm*2)/100) * quantidade
  fixo            → custo
  → multiplica por (1 + margem_pct/100)

preco_total = preco_midia + preco_impressao + soma(acabamentos)
se preco_total < material.valor_minimo
   preco_total = material.valor_minimo
   aplicou_minimo = true

arredondar PARA CIMA até múltiplo de R$ 0,10 (regra global)
```

Retorno também inclui campos de "saúde" (`custo_total`, `lucro_liquido`, `margem_pct`) usados só no Modo Admin.

Testes em `src/test/cv-pricing.test.ts` cobrindo: emenda, valor mínimo, cada `tipo_calculo` de acabamento, arredondamento.

### 3. Cadastros — `src/pages/CadastrosCV.tsx`

Página com 3 abas seguindo o visual de `MateriasPrimas.tsx` (Tabs do shadcn, cards, botão "+ Novo" na mesma linha da busca):

- Aba **Materiais** — CRUD de `cv_materials`, com campo categoria (Select), largura útil, custos e valor mínimo.
- Aba **Impressoras** — CRUD de `cv_printers`, com multi-select de `categorias_compativeis` (lona/adesivo/chapa/outro).
- Aba **Acabamentos** — CRUD de `cv_finishes`, com `tipo_calculo` em Select e multi-select de compatibilidade.

Item de menu na sidebar dentro do grupo Cadastros: "Comunicação Visual" → `/cadastros-cv`.

### 4. Card reativo — `src/components/orcamentos-v2/CVItemCard.tsx`

Layout dentro de `NewQuoteFormV2.tsx`, em uma nova seção "Comunicação Visual":

```text
┌─ Item de Comunicação Visual ──────────────────────────┐
│ [Material ▼ Lona Brilho 440g]                         │
│ [Impressora ▼ Mimaki JV150 (filtrado p/ lona)]       │
│ Largura: [90] cm   Altura: [120] cm   Qtd: [1]       │
│ Área: 1,08 m²                                         │
│ ⚠ Largura excede impressora (1,06m). Terá emenda.    │
│                                                       │
│ Acabamentos: [+ Ilhós ×4] [+ Bainha (perímetro)]      │
│  (combobox mostra só compatíveis com 'lona')          │
│                                                       │
│ Total: R$ 150,00                            [Excluir] │
│                                                       │
│ ▼ Saúde do orçamento (admin)                          │
│   Mídia R$60 · Impressão R$70 · Acabamentos R$20     │
│   Custo R$95 · Lucro R$55 · Margem 36% 🟢            │
└───────────────────────────────────────────────────────┘
```

- Inputs numéricos com sufixo "cm", validação ≥ 0 e debounce de 150 ms antes de recalcular.
- **Filtros inteligentes:** ao escolher material categoria=lona, o Select de impressora filtra `categorias_compativeis ∋ 'lona'`. O combobox de acabamento filtra `categoria_compativel ∋ 'lona'`. Trocar de material limpa seleções incompatíveis.
- **Aviso de emenda:** banner amarelo discreto quando `tem_emenda`, sem bloquear.
- **Painel "Saúde do Orçamento":** só renderizado quando `profile.role === 'admin'` (via `useAuth`). Usa `marginTextClass`/`marginLabel` do `lib/quotes-v2/margin.ts` para o semáforo.

### 5. Integração no NewQuoteFormV2

- Nova seção "Comunicação Visual" ao lado das atuais, com botão "+ Adicionar item CV" gerando múltiplos cards.
- Estado local `cvItems[]`; ao salvar o quote, persistir cada item em `cv_quote_items` com o `quote_id` recém-criado.
- A soma de `preco_total` dos itens CV entra no `quotes.value` junto com os itens gráficos atuais (mesma coluna `value` consolidada).
- Ao editar um quote existente, carregar `cv_quote_items` filtrando por `quote_id`.

### 6. WhatsApp — `src/lib/quotes-v2/whatsapp.ts`

Nova função `buildCVProposalMessage({ quoteNumber, items, total, clientName, companyName })`:

```text
Olá {cliente}! Segue a proposta {quoteNumber}:

📦 *Item 1:* Lona Brilho 440g (90×120cm) c/ Ilhós ×4 — *R$ 150,00*
📦 *Item 2:* Adesivo Vinil (50×30cm) c/ Recorte — *R$ 80,00*
─────────────
💰 *Total: R$ 230,00*
```

Botão "Copiar proposta WhatsApp" na tela de proposta, reutilizando `buildWaUrl` e o telefone de `company_settings`.

### 7. Permissões (Admin x Vendedor)

- Reaproveita `is_profile_admin` (já existente).
- **Colaborador:** vê inputs, total e proposta. Não vê custos, margem nem semáforo.
- **Admin:** vê tudo, inclusive a "Saúde do Orçamento" no card.
- Cadastros (`/cadastros-cv`) restrito a admin via RLS — colaborador consegue ler para preencher orçamento, mas não cria/edita.

### 8. Fora de escopo desta entrega

- Baixa real de estoque (só persistimos `area_total_m2` para uso futuro).
- Conversão automática entre unidades de suprimento.
- Importação em massa de materiais/impressoras/acabamentos (cadastro manual por enquanto).

### Arquivos afetados

- `supabase/migrations/<novo>.sql` — 4 tabelas + RLS + triggers.
- `src/pages/CadastrosCV.tsx` (novo) e rota em `src/App.tsx`.
- `src/components/Sidebar.tsx` — novo item "Comunicação Visual".
- `src/lib/cv-pricing/engine.ts` (novo) + `src/test/cv-pricing.test.ts`.
- `src/components/orcamentos-v2/CVItemCard.tsx` (novo).
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — nova seção + persistência.
- `src/lib/quotes-v2/whatsapp.ts` — `buildCVProposalMessage`.
- `src/integrations/supabase/types.ts` regenerado automaticamente após a migration.
