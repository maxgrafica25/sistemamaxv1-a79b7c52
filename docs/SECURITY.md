# Segurança Multi-Tenant — Diretrizes

## 1. Proibição do `service_role_key` no frontend

### Regra absoluta
**O `SUPABASE_SERVICE_ROLE_KEY` NUNCA pode ser usado em código que roda no navegador.**

A chave `service_role` ignora completamente as políticas de Row Level Security (RLS), o que significa que qualquer requisição feita com ela tem acesso irrestrito a **todos os dados de todas as empresas** (Max Gráfica, e qualquer outra gráfica assinante no futuro). Expor essa chave no frontend equivale a entregar o banco inteiro para qualquer visitante do site.

### Onde a `service_role` pode ser usada
Exclusivamente em ambientes server-side controlados:
- **Edge Functions do Supabase** (`supabase/functions/*`), lendo de `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`.
- Scripts administrativos rodados pela equipe (nunca commitados com a chave em claro).
- Webhooks/cron jobs server-side.

### Onde está PROIBIDO usar
- Qualquer arquivo dentro de `src/` (React, hooks, componentes).
- Variáveis de ambiente do Vite (`VITE_*`) — tudo prefixado com `VITE_` é embutido no bundle público.
- `localStorage`, `sessionStorage`, cookies não-httpOnly.
- Repositórios públicos / commits.

### Cliente correto no frontend
O único cliente Supabase permitido no frontend é o gerado automaticamente em `src/integrations/supabase/client.ts`, que usa apenas:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key — segura para uso público)

A anon key respeita RLS, então o usuário só enxerga dados da própria empresa (`empresa_id = current_empresa_id()`).

### Como executar operações administrativas
Se uma feature precisar burlar RLS (ex.: operação cross-tenant, agregação global, ação de superadmin), a regra é:
1. Criar uma **Edge Function** (`supabase/functions/<nome>/index.ts`).
2. A função valida o JWT do usuário e checa permissões (`is_profile_admin`, etc.).
3. Só então usa o `SUPABASE_SERVICE_ROLE_KEY` para executar a operação.
4. O frontend invoca via `supabase.functions.invoke('<nome>', { body: {...} })`.

### Como auditar
- Buscar no projeto: `rg -n "service_role" src/` — deve retornar **zero** resultados.
- Buscar no projeto: `rg -n "SERVICE_ROLE" src/` — deve retornar **zero** resultados.
- Edge functions podem (e devem) usar a chave, então é normal encontrá-la em `supabase/functions/`.

---

## 2. Trava de tenant em novas tabelas (Migration 4)

A partir da Migration 4, o banco possui o event trigger `enforce_tenant_column_trg`, que bloqueia qualquer `CREATE TABLE` no schema `public` que não tenha:
- Coluna `empresa_id uuid NOT NULL`
- FOREIGN KEY apontando para `public.empresas(id)`

### Template padrão para novas tabelas
```sql
CREATE TABLE public.minha_nova_tabela (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT public.current_empresa_id()
    REFERENCES public.empresas(id) ON DELETE RESTRICT,
  -- ... outros campos
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_minha_nova_tabela_empresa ON public.minha_nova_tabela(empresa_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.minha_nova_tabela TO authenticated;
GRANT ALL ON public.minha_nova_tabela TO service_role;

ALTER TABLE public.minha_nova_tabela ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.minha_nova_tabela
  FOR SELECT TO authenticated
  USING (empresa_id = public.current_empresa_id()
         AND public.empresa_ativa(empresa_id));

CREATE POLICY "tenant_isolation_write" ON public.minha_nova_tabela
  FOR ALL TO authenticated
  USING (empresa_id = public.current_empresa_id()
         AND public.empresa_ativa(empresa_id))
  WITH CHECK (empresa_id = public.current_empresa_id()
              AND public.empresa_ativa(empresa_id));
```

### Exceções (whitelist)
Se a tabela for legitimamente global/sistema (ex.: categorias universais, contadores globais, tabelas legadas), inserir o nome em `public.tenant_enforcement_whitelist`:

```sql
INSERT INTO public.tenant_enforcement_whitelist (table_name, reason)
VALUES ('nome_da_tabela', 'Justificativa clara do porquê é global');
```

Só admins do banco devem manipular essa whitelist.
