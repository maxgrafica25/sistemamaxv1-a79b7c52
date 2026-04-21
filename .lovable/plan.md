

# Auditoria complementar — 3 itens

## 1) Validação de input em Edge Functions (zod)

Adicionar schemas zod no início de cada função e parsear o body antes de qualquer uso. Retornar 400 com erros estruturados quando inválido.

**`scrape-prices/index.ts`** — body aceita 2 formatos:
```ts
const BodySchema = z.union([
  z.object({ site_id: z.string().uuid() }),
  z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(20) }),
]);
```
Validar largura de URLs (evita SSRF de URLs absurdas) e cap em 20 URLs por chamada.

**`sync-prices-webhook/index.ts`** — endpoint público (token VPS), risco maior:
```ts
const TierSchema = z.object({
  quantidade: z.number().int().positive().max(1_000_000),
  preco_total: z.number().nonnegative().max(10_000_000),
  preco_unitario: z.number().nonnegative().max(10_000_000).optional(),
});
const BodySchema = z.object({
  site_id: z.string().uuid(),
  tiers: z.array(TierSchema).min(1).max(100),
  origem: z.string().max(50).optional(),
});
```

**`backup-database/index.ts`** — só lê `format` da querystring, mas atualmente aceita qualquer string e cai pra "sql". Apertar:
```ts
const format = z.enum(["sql","json"]).catch("sql").parse(url.searchParams.get("format") ?? "sql");
```

Import: `import { z } from "https://esm.sh/zod@3.23.8";` (mesma versão usada no resto do projeto se houver — senão essa).

## 2) Trocar `select("*")` por colunas explícitas — apenas tabelas financeiras

| Arquivo | Linha(s) | Tabela |
|---|---|---|
| `src/pages/Orcamentos.tsx` | 74, 97-99 | `quotes`, `quote_labor_steps`, `quote_materials`, `quote_third_party` |
| `src/pages/DespesasFixas.tsx` | 49, 50, 52 | `monthly_expenses`, `salaries`, `productive_capacity` |
| `src/pages/Configuracoes.tsx` | 72 | `productive_capacity` |
| `src/pages/PrecoImpressao.tsx` | 188, 193 | `markup_tiers`, `markup_groups` |
| `src/components/orcamentos/NewQuoteForm.tsx` | 154, 155, 289 | `markup_tiers`, `global_settings`, `productive_capacity` |

Cada um vira lista explícita das colunas usadas no componente. Exemplo `quotes`:
```ts
.select("id, quote_number, client, product, value, status, rejection_reason, validity, profit_margin, created_at, updated_at")
```

**Não mexer em:** `production_steps`, `step_groups`, `supplies`, `printing_price_items`, `printer_categories` (mesma chamada do `loadCatalogData` — não financeiras).

## 3) Modelo B parcial — `created_by` em `equipment_maintenances` e `production_losses`

### Migration
```sql
ALTER TABLE public.equipment_maintenances ADD COLUMN created_by uuid;
ALTER TABLE public.production_losses     ADD COLUMN created_by uuid;

-- Atribuir registros existentes ao admin principal (Juliano)
UPDATE public.equipment_maintenances SET created_by = '52dbbc24-276a-420c-86db-0e8192324001' WHERE created_by IS NULL;
UPDATE public.production_losses     SET created_by = '52dbbc24-276a-420c-86db-0e8192324001' WHERE created_by IS NULL;

-- Endurecer DELETE: drop a política antiga "Authenticated can delete *"
DROP POLICY "Authenticated can delete equipment_maintenances" ON public.equipment_maintenances;
DROP POLICY "Authenticated can delete production_losses"     ON public.production_losses;

CREATE POLICY "Owner or admin delete equipment_maintenances"
  ON public.equipment_maintenances FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_profile_admin(auth.uid()));

CREATE POLICY "Owner or admin delete production_losses"
  ON public.production_losses FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_profile_admin(auth.uid()));

-- INSERT: forçar created_by = auth.uid() (impede falsificar autoria)
DROP POLICY "Authenticated can insert equipment_maintenances" ON public.equipment_maintenances;
DROP POLICY "Authenticated can insert production_losses"     ON public.production_losses;

CREATE POLICY "Insert equipment_maintenances as self"
  ON public.equipment_maintenances FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Insert production_losses as self"
  ON public.production_losses FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
```

Volume migrado: 0 manutenções + 1 perda. Risco zero.

### Mudanças de código
- **`MaintenanceTab.tsx`** (`save`, linha 190-207): adicionar `created_by: user?.id` no payload de insert. Importar `useAuth` (já disponível no projeto). Em update **não** mexer em `created_by`.
- **`ProductionLossesTab.tsx`** (`handleSave`, linha 88-94): adicionar `created_by: user?.id` no insert. `useAuth` já está importado.
- **UX:** botão de delete continua visível pra todos, mas ao clicar usuário sem permissão recebe toast traduzido pelo `handleError` (já trata RLS errors com mensagem amigável).

## Validação pós-implementação

1. `supabase--linter` — confirmar contagem de warnings (esperado: -2 nas tabelas endurecidas).
2. Verificar visualmente que insert de manutenção/perda funciona (created_by preenchido).
3. Teste manual: logar como colaborador → tentar deletar perda criada por outro → deve falhar com toast.

## Fora de escopo

- Modelo B nas outras 8 tabelas operacionais (`quotes`, `clients`, `printer_readings`, etc.) — fica como decisão futura por tabela.
- UPDATE restrito ao criador — pedido foi só DELETE; manter UPDATE aberto preserva fluxo de correções colaborativas.

## Resumo de arquivos

| Ação | Arquivo |
|---|---|
| Editar | `supabase/functions/scrape-prices/index.ts` (zod) |
| Editar | `supabase/functions/sync-prices-webhook/index.ts` (zod) |
| Editar | `supabase/functions/backup-database/index.ts` (zod no format) |
| Editar | `src/pages/Orcamentos.tsx` |
| Editar | `src/pages/DespesasFixas.tsx` |
| Editar | `src/pages/Configuracoes.tsx` |
| Editar | `src/pages/PrecoImpressao.tsx` |
| Editar | `src/components/orcamentos/NewQuoteForm.tsx` |
| Editar | `src/components/equipamentos/MaintenanceTab.tsx` |
| Editar | `src/components/equipamentos/ProductionLossesTab.tsx` |
| Migration | nova (created_by + RLS endurecida) |

