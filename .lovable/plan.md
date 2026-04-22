

# Assistente virtual com Gemini — botão flutuante global

## Visão geral

Assistente conversacional acessível em qualquer tela via botão flutuante no canto inferior direito. Responde em português usando Lovable AI (Gemini), combinando base de conhecimento gerenciável + dados ao vivo do banco + histórico recente da conversa.

## Decisões técnicas confirmadas

- **Lovable AI Gateway** (`google/gemini-2.5-flash`) usando `LOVABLE_API_KEY` já existente — sem chave nova.
- **`verify_jwt = true`** (padrão) — `supabase.functions.invoke()` envia o JWT automaticamente; validação interna na função. Sem URL pública aberta.
- **Nomes de tabelas/colunas confirmados** no schema real do projeto (sem chute).

## Tabelas/colunas reais utilizadas

| Tabela | Colunas usadas |
|---|---|
| `equipments` | `id, name, description, printer_type` |
| `equipment_consumables` | `id, equipment_id, name, price, yield_pages, mode` |
| `printer_readings` | `equipment_id, total_prints, type, reading_time` |
| `printing_price_items` | `printer_category_id, equipment_id, paper_type, grammage, size, side, paper_cost, printing_cost, equipment_mode, is_active` |
| `printer_categories` | `id, name` |
| `markup_tiers` | `printer_category_id, label, min_qty, max_qty, fixed_cost_pct, variable_cost_pct, margin_pct` |
| `papers` | `name, grammage, sheet_qty, pack_price, freight_price, is_active` |
| `global_settings` | impostos, taxas, margem padrão |
| `base_conhecimento` (nova) | `titulo, conteudo, categoria, ativo` |

## Parte 1 — Migration `base_conhecimento`

```sql
CREATE TABLE public.base_conhecimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  conteudo text NOT NULL,
  categoria text,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.base_conhecimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read base_conhecimento" ON public.base_conhecimento
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin insert base_conhecimento" ON public.base_conhecimento
  FOR INSERT TO authenticated WITH CHECK (public.is_profile_admin(auth.uid()));
CREATE POLICY "admin update base_conhecimento" ON public.base_conhecimento
  FOR UPDATE TO authenticated USING (public.is_profile_admin(auth.uid()));
CREATE POLICY "admin delete base_conhecimento" ON public.base_conhecimento
  FOR DELETE TO authenticated USING (public.is_profile_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.set_atualizado_em()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em := now(); RETURN NEW; END $$;

CREATE TRIGGER trg_base_conhecimento_atualizado
  BEFORE UPDATE ON public.base_conhecimento
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em();
```

## Parte 2 — Edge Function `assistente-virtual`

`supabase/functions/assistente-virtual/index.ts` (sem alteração no `config.toml`).

**Recebe:** `{ pergunta: string, historico: { role, content }[] }`  
**Retorna:** `{ resposta: string }`

**Fluxo:**
1. CORS + OPTIONS.
2. Validar `Authorization: Bearer <jwt>` via `getClaims()` — 401 se inválido.
3. Validar body com Zod (`pergunta` 1–4000 chars, `historico` máx 20).
4. Buscar dados ao vivo em paralelo (`Promise.all`) via `getAdminClient` (já existente).
5. Calcular **impressões desde último toner** por equipamento (última leitura geral – última `type='toner_change'`); cruzar com `yield_pages` para estimar restante.
6. Montar **system prompt em 3 camadas**:
   - **Comportamento**: PT-BR, tom direto, regra crítica de pedir esclarecimento quando faltar dado.
   - **Base de conhecimento**: `### {titulo} [{categoria}]\n{conteudo}`.
   - **Dados operacionais**: blocos formatados de Equipamentos/Consumíveis, Papéis, Preços por Categoria/Tier, Configurações Globais.
7. Chamar Lovable AI Gateway (`google/gemini-2.5-flash`, não-streaming) com `system + historico.slice(-10) + pergunta`.
8. Tratar **429** (rate limit) e **402** (créditos) com mensagens amigáveis.
9. Retornar `{ resposta }`.

## Parte 3 — Frontend

**`src/components/assistente/AssistenteMensagem.tsx`** — bolha de mensagem (user direita/primária, assistant esquerda/muted), `whitespace-pre-wrap`.

**`src/components/assistente/AssistenteButton.tsx`**:
- Botão flutuante: `fixed bottom-6 right-6 z-50`, círculo 52×52, `bg-primary`, ícone `Sparkles`, `shadow-lg`. Badge vermelho com contador de não lidas.
- Sheet `side="right"` largura 420px, não bloqueia conteúdo.
- Header (ícone + "Assistente" + close), ScrollArea de mensagens, indicador "digitando…" animado, input + botão Enviar (Enter envia, Shift+Enter quebra linha).
- Estado em memória durante a sessão; envia via `supabase.functions.invoke('assistente-virtual', { body: { pergunta, historico: messages.slice(-10) } })`.
- Toasts amigáveis para 429/402.

**`src/App.tsx`** — montar `<AssistenteButton />` dentro de `<AuthProvider>` mas fora de `<Routes>`. Internamente checa `useAuth().user` — só renderiza se logado. Não aparece em `/auth` nem `/reset-password`.

## Parte 4 — Gerenciamento da base de conhecimento

Em `src/pages/Configuracoes.tsx`, adicionar **terceira aba "Base de Conhecimento"** (visível apenas para admin):

- Tabela: Título | Categoria | Status | Atualizado em | Ações (editar/excluir).
- Botão "Novo conhecimento" → Dialog: Título (obrigatório), Categoria (livre), Conteúdo (textarea ≥6 linhas), Switch ativo.
- Edição reusa o mesmo dialog em modo edit.
- Exclusão via `ConfirmDialog` existente.
- Sem paginação; ordenado por `atualizado_em desc`.

## Roteiro de validação pós-implementação

1. Confirmar que o botão flutuante **não aparece** em `/auth` e `/reset-password`.
2. Pergunta simples sem dados (ex: "o que você sabe fazer?") — valida que a Edge Function responde.
3. Pergunta de toner — confirma que os dados ao vivo chegam corretamente.
4. Pergunta incompleta de preço — verifica se o assistente **pede esclarecimento** em vez de inventar resposta. Esse é o teste mais importante.

## Arquivos afetados

**Novos:**
- `supabase/migrations/<timestamp>_base_conhecimento.sql`
- `supabase/functions/assistente-virtual/index.ts`
- `src/components/assistente/AssistenteButton.tsx`
- `src/components/assistente/AssistenteMensagem.tsx`

**Modificados:**
- `src/App.tsx` — montar `<AssistenteButton />` global condicionado a usuário autenticado.
- `src/pages/Configuracoes.tsx` — nova aba "Base de Conhecimento" para admin.

## Fora de escopo

- Streaming token-a-token.
- Persistir histórico entre sessões.
- Voz, múltiplos perfis, integração com Chat Interno.
- Mudanças em tabelas operacionais (apenas leitura).

## Risco

Baixo. Função protegida por JWT, schemas confirmados, migration isolada com RLS. Único ponto a acompanhar: cálculo de "impressões desde último toner" é estimativa compartilhada por equipamento. Se virar problema, evolução futura mapeada: adicionar `consumable_id` em `printer_readings`.

