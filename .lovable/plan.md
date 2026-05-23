# Fonte única de Suprimentos e Mão de Obra — sistema todo

## Diagnóstico de inconsistência

### Suprimentos
Já existe uma **única fonte**: tabela `supplies`. Todos os leitores (`SupplySearch`, `useV3Supplies`, `useV3CVCatalog`, `SmartFinishingBlock`, formulários V2/V3, `KitsProduto`, `VariantsDialog`, abas CV) batem nela. **Nada a corrigir aqui.**

### Mão de obra / Acabamentos (Etapas)
Existem **duas fontes** competindo:

| Fonte | Tabela | Cadastro em |
|---|---|---|
| Etapas individuais | `production_steps` | `/processos-producao` → aba **Etapas** |
| Itens dentro de Grupos | `step_group_items` (description é string solta) | `/processos-producao` → aba **Grupos de Etapas** |

Itens dentro de Grupos **não** são FK para Etapas — são strings denormalizadas. Resultado: a mesma "Furação" pode existir só num grupo e estar invisível para qualquer feature que leia `production_steps`.

**Quem lê `production_steps` (e ignora Grupos):**
- `useV3ProcessCatalog` (carrega ambos, mas como listas separadas)
- `useProductKitProcesses` (Kits de Produto)
- `bookletKit.ts` (Kit Encadernação)
- `BusinessCardForm`, `NewQuoteFormV2`, `LoadFromGroupDialog`, `KitsProduto`, `AcabamentosTab` (CV), `lib/finishings/catalog.ts`

## Princípio proposto

> **Toda etapa de mão de obra existe em `production_steps`.**
> Grupos de Etapas são apenas **combos reutilizáveis** que apontam para Etapas já cadastradas — não criam etapas novas.

Isso espelha o que já vale para Suprimentos.

## Caminho em 3 fases

### Fase 1 — Tornar tudo enxergar as duas fontes (compatibilidade, sem migração)

Objetivo: parar o sintoma imediato. Nenhum recadastro exigido.

1. Criar helper `useAllProductionSteps()` em `src/hooks/` que retorna `production_steps ∪ step_group_items` achatado, com campo `source: "step" | "group"` e `group_name?: string` para itens de grupo.
2. Substituir consumidores que fazem busca/regex por etapas (não Grupos inteiros): `bookletKit`, `useProductKitProcesses` (parte de matching), `lib/finishings/catalog`, qualquer autocomplete.
3. Em buscas: prioridade `step` > `group`. Em empate dentro de Grupos, prefere grupo cujo nome tenha contexto relevante (ex.: kit espiral prefere grupo com "encadernação").
4. UI inalterada — Grupos continuam funcionando como combos.

**Arquivos tocados:** `useV3ProcessCatalog.ts` (expor `allSteps`), `bookletKit.ts` (usar `allSteps`), `useProductKitProcesses.ts`, `lib/finishings/catalog.ts`, `BusinessCardForm.tsx`, `AcabamentosTab.tsx` (cv-calc). 1 novo hook, ~6 arquivos editados.

### Fase 2 — Normalização gradual (schema)

1. Migration: adicionar `step_group_items.production_step_id UUID` (nullable inicialmente) com FK para `production_steps(id)`.
2. Script de migração de dados: para cada `step_group_items` atual, fazer match por `description` (case-insensitive trim) com `production_steps`; se não achar, criar a Etapa correspondente e amarrar a FK. Avisa duplicatas no log para revisão humana.
3. Rodar diagnóstico via `read_query` antes para mostrar quantos itens órfãos existem e quantos têm match exato.

### Fase 3 — Fonte única canônica

1. UI de Grupos passa a usar um **picker de Etapas existentes** em vez de campos livres. Remove `description`/`time_minutes`/`step_type` do form de item de grupo — só `production_step_id` + `sort_order`.
2. Migration: tornar `production_step_id` `NOT NULL`, dropar colunas denormalizadas (`description`, `time_minutes`, `step_type`) de `step_group_items`.
3. Todos os consumidores deixam de precisar achatar — basta `JOIN` no FK.

## Recomendação

**Fase 1 imediatamente** (resolve a Furação do Kit Encadernação e qualquer outro caso oculto no sistema sem mexer em schema). **Fase 2 quando confortável** (não tem urgência se Fase 1 já cobre a UX). **Fase 3 quando quiser limpar o schema de vez** (opcional).

Posso começar pela Fase 1 e abrir um relatório com `read_query` mostrando quantos itens de Grupos existem hoje sem correspondente em Etapas — assim você decide se Fase 2 vale a pena.

## Fora de escopo

- Suprimentos: já é fonte única.
- `GruposMateriais`/`MateriasPrimas` (parecem outro domínio — papéis/materiais — sem duplicidade reportada).
- Edge functions/relatórios server-side.
