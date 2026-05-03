## Refinamento do header — Novo Orçamento V2 (revisado)

Ajustes de UX no header para refletir o fluxo real do vendedor: a quantidade vem primeiro, validade tem padrão global mas continua editável caso a caso, e o orçamento já abre com 1 impresso pronto.

### Arquivos afetados
- `supabase/migrations/...` — adicionar `company_settings.default_quote_validity_days` e `quotes.main_quantity`
- `src/hooks/useCompanySettings.tsx` — expor `default_quote_validity_days`
- `src/components/configuracoes/CompanyTab.tsx` — input para configurar a validade padrão
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — refatorar header e auto-criar 1 item
- `src/components/orcamentos-v2/QuoteOptionsBuilder.tsx` — variante "chips" inline para o topo

### 1. Margem removida do header
- O input "Margem (%)" sai do grid. State `profitMargin` continua existindo, populado pelo `default_margin_pct` global e pelos tiers dos produtos. Margem real é dirigida pelos cadastros — sem UI poluindo o topo.

### 2. Validade — padrão global, mas editável
- Nova coluna `company_settings.default_quote_validity_days` (default `15`).
- Em **Configurações → Empresa**, novo input "Validade padrão dos orçamentos (dias)".
- No `NewQuoteFormV2`, ao criar um orçamento novo, `validity` é inicializada com esse valor.
- **O campo Validade permanece visível e editável no formulário** — em vez de ocupar uma coluna gorda do grid, vira um input compacto inline ao lado do Cliente (ex: 90px de largura, label sutil "Validade: __ dias"). Vendedor pode mudar para 60 dias (licitação) ou 3 dias (queima) sem sair da tela. Caso especial não engessa o caso comum.

### 3. Quantidade desejada no topo
Logo abaixo do título "Notion-style", antes do grid Cliente/Validade:

```text
[Título grande do projeto]
─────────────────
Quantidade desejada: [  1000  ] unidades
Outras quantidades a cotar (ancoragem):  [500 ✕] [2000 ✕] [+ adicionar]
─────────────────
[Nº Orçamento]  [Cliente]  [Validade (dias)]
```

- Novo state `mainQuantity` (number) — input numérico grande, label clara.
- **Não substitui** o campo "Quantidade (folhas)" dentro de cada `PrintingItemEditor` — folhas ≠ unidades quando há montagem múltipla na imposição (ex.: 1000 cartões em 125 folhas A4 = imposição 8-up; ou 1000 cartões em 250 folhas = 4-up). Os dois convivem.
- Persistido em `quotes.main_quantity` (integer, nullable) — backwards compatible.

### 4. Chips de ancoragem no topo
Reaproveitar `QuoteOptionsBuilder` em variante compacta (prop `variant="chips"`):
- Renderiza apenas o input + chips das quantidades (sem card grande, sem deltas %).
- Cada chip mostra `1000 un` com X para remover.
- Ao adicionar/remover, dispara o mesmo `recalculateForQuantity` (lógica intacta).
- A versão **completa** do `QuoteOptionsBuilder` (cards de unitário, total, delta %) **continua aparecendo no final do formulário** como visualização/confirmação.
- Mesmo `options: QuoteOption[]` alimenta os dois — adicionar em qualquer um reflete no outro.

### 5. Auto-abrir 1 item de impressão
Em `NewQuoteFormV2.tsx`, no `loadInit` quando `!isEditing`:
- Após carregar catálogo, criar 1 entrada vazia em `materials[]` com `parentItemId=null`, `quantity=0`, `paper_id=null` — para que `PrintingItemEditor` já apareça pronto pra preenchimento.
- Mantém `PrintingItemSearch` acima da lista (caso raro: capa + miolo) e mantém o botão remover (orçamento só de Comunicação Visual).

### Migração SQL
```sql
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_quote_validity_days int NOT NULL DEFAULT 15;

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS main_quantity int;
```

### O que NÃO muda
- Lógica de pricing, snapshot, recalculate, RLS, schema dos itens.
- `StickyFinancialSidebar`, separadores, layout master-detail aprovado anteriormente.
- Campo "Quantidade (folhas)" dentro do `PrintingItemEditor`.
- O `QuoteOptionsBuilder` completo no rodapé do formulário.

### Resultado esperado
Header sequencial: **Título → Quantidade + ancoragem → Cliente + Validade compacta**. Validade mantém o default global de 15 dias mas continua editável por orçamento, preservando o poder do vendedor em casos especiais (licitação 60 dias, queima 3 dias). Margem some do topo (vem dos cadastros). Formulário já abre com 1 impresso pronto pra editar.
