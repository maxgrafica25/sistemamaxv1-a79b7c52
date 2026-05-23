# Persistir `art_status` em CV (cv_quote_items)

## Por quê
Hoje, itens de impressão gravam `art_status` em `quote_materials`, mas itens de CV vivem em `cv_quote_items` e só carregam o status na UI. Ao reabrir, duplicar ou versionar um orçamento de CV, perdemos:
- a faixa de arte escolhida (que também afeta custo via acabamento vinculado),
- o registro de "arte terceirizada" (valor manual),
- a possibilidade de revalidar o bloqueio de envio sem resposta.

## Mudanças

### 1. Migration
Adicionar coluna em `public.cv_quote_items`:
- `art_status text NULL` — aceita `'ready' | 'ajuste' | 'facil' | 'moderada' | 'elaborada' | 'terceirizada'` (validação fica no app, igual ao padrão atual de `quote_materials.art_status`).

Sem default, sem backfill (itens antigos ficam `NULL` — a validação de obrigatoriedade só vale para novos envios, mesmo critério já aplicado em impressão).

### 2. Persistência (`src/components/orcamentos-v3/shared/saveQuoteV3.ts`)
- No `INSERT` em `cv_quote_items`, incluir `art_status: item.art_status ?? null`.
- No SELECT de releitura (quando houver — caso de edição/duplicação), passar `art_status` de volta ao estado do carrinho.

### 3. Tipos
- `src/integrations/supabase/types.ts` é auto-gerado pela migration — sem edição manual.
- Ajustar o tipo local de item de CV (onde montamos o payload) para incluir `art_status?: ArtStatus | null`.

### 4. Carrinho e validação
- Sem mudanças na UI: `ArtePromptBlock` já está integrado no `CVForm`, e `UnifiedCart` já exibe o badge.
- A validação bloqueante em `NewQuoteFormV3` continua igual — agora com a garantia de que o valor sobrevive ao reload.

## Fora de escopo
- Itens de arte terceirizada de CV continuam usando `quote_third_party` (já persistido).
- Não mexe em v1/v2 nem em outras tabelas.

Aprovação necessária para rodar a migration.
