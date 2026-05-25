## Objetivo

Adicionar o favorito **Tags** ao módulo Impressão, já vindo configurado com:
- **Papel padrão:** Couchê 300g (auto-selecionado ao abrir)
- **Lado:** F/V disponível (padrão F/V quando existir no catálogo; senão F)
- **Acabamento pré-marcado:** Recorte (mesma família usada no Adesivo — "Recorte Folhas Papéis Especiais", já que Couchê é categoria *especial*)
- Filtro de categoria: **Especial**

Para isso, o cadastro de favoritos precisa ganhar 3 campos novos (papel padrão, lado padrão e flag de pré-marcar acabamentos). Hoje `papel_inclui` e `acabamentos_sugeridos` só **filtram/sugerem**, não pré-selecionam.

## Mudanças

### 1. Migration — novos campos em `quote_presets`
```sql
ALTER TABLE public.quote_presets
  ADD COLUMN papel_default_nome       text,
  ADD COLUMN papel_default_grammage   text,
  ADD COLUMN side_default             text,         -- 'F' | 'F/V'
  ADD COLUMN preselect_acabamentos    boolean NOT NULL DEFAULT false;
```

### 2. Seed do preset Tags (mesma migration, `INSERT`)
- `nome = 'Tags'`, `icone = 'Tag'`, `modulo = 'impressao'`, `form_tipo = 'print'`, `ordem = 55`
- `papel_inclui = ARRAY['couchê','couche']` (filtra chips/categoria especial)
- `papel_default_nome = 'couchê'`, `papel_default_grammage = '300'`
- `side_default = 'F/V'`
- `acabamentos_sugeridos = ARRAY['<id de Recorte Folhas Papéis Especiais>']`
- `preselect_acabamentos = true`

### 3. `useQuotePresets.ts` + `QuotePresets.tsx`
- Adicionar os 4 campos novos ao type `QuotePreset` e ao formulário de cadastro:
  - Seletor "Papel padrão" (nome + gramatura, opcional)
  - Select "Lado padrão" (— / F / F/V)
  - Switch "Pré-marcar acabamentos sugeridos"
- Persistir junto do `save`.

### 4. `PrintForm.tsx`
- Novos props: `defaultPaperHint?: { name: string; grammage?: string; side?: string }` e `preselectedFinishings?: string[]`.
- Ao carregar o catálogo pela primeira vez (sem `catalog` definido), se houver `defaultPaperHint`, procurar em `items` o primeiro `PrintingCatalogItem` que case por `paper_type` (normalizado) + `grammage` + `side` (com fallback: ignorar `side` se não bater). Setar via `setCatalog(...)` e disparar `onSelectionChange`.
- Se `preselectedFinishings?.length`, popular `finEnabled` com esses ids (uma vez, gated por ref como o `suggestAllFinishings`).

### 5. `PrintAndProductForm.tsx`
- Quando renderiza `PrintForm` em modo preset, passar:
  - `defaultPaperHint = { name: selectedPreset.papel_default_nome, grammage: selectedPreset.papel_default_grammage, side: selectedPreset.side_default }` (somente se nome existir)
  - `preselectedFinishings = selectedPreset.preselect_acabamentos ? selectedPreset.acabamentos_sugeridos : undefined`

## Fora de escopo
- Aplicar pré-seleção de papel ao módulo CV/etiquetas.
- Alterar o preset "Adesivo" existente (continua sem default — usuário cadastra depois pela tela se quiser).
- Editor visual de "qual catálogo exato pré-selecionar" (resolução é por busca textual, primeiro match).

## Arquivos
- `supabase/migrations/<novo>.sql` (DDL + INSERT do seed)
- `src/components/orcamentos-v3/shared/useQuotePresets.ts`
- `src/pages/QuotePresets.tsx`
- `src/components/orcamentos-v3/forms/PrintForm.tsx`
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
