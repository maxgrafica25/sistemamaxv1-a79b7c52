## Objetivo

Substituir o campo livre **Tipo de produto** do Kit por um vínculo direto aos **Produtos Favoritos** já cadastrados (tabela `quote_presets` — Banner, Cartão de Visita, Apostila, Etiqueta, etc.), permitindo que **um mesmo kit sirva para vários produtos** (N:N).

---

## O que muda na prática (para o usuário)

1. No diálogo **Novo Kit / Editar Kit**:
   - Campo "Tipo de produto" (digitação livre) → vira **"Aplica-se aos produtos"** com **seletor de múltipla escolha** mostrando os produtos favoritos ativos.
   - Você pode marcar 1 ou vários (ex.: o mesmo kit "Laminação BOPP Brilho" pode valer para **Cartão de Visita** e **Folheto**).
2. Na **listagem de Kits**: agrupa os kits pelos produtos vinculados (um kit aparece em todos os grupos a que pertence).
3. No **orçamento**: quando você abre um produto favorito (ex.: Cartão de Visita), o formulário busca todos os kits vinculados àquele preset, e mostra:
   - Etapas **obrigatórias** já marcadas e fixas.
   - Etapas **opcionais** disponíveis para ligar/desligar.
4. Em **Produtos Favoritos** (Vender → Orçamentos → gerenciar): nada muda na edição do preset em si.

---

## Mudanças técnicas

### 1. Banco
Nova tabela de junção N:N `product_kit_presets`:
- `kit_id` → `product_kits.id` (ON DELETE CASCADE)
- `preset_id` → `quote_presets.id` (ON DELETE CASCADE)
- PK composta `(kit_id, preset_id)`
- RLS: leitura para autenticados; insert/update/delete apenas admin (espelha `product_kits`).

Mantém a coluna `product_kits.product_kind` por compatibilidade (legado/sementes), mas ela deixa de ser editada pela UI.

### 2. Página `KitsProduto.tsx`
- Remove `Input + datalist` de "Tipo de produto".
- Adiciona componente multi-select (chips/badges) carregando `quote_presets` ativos via `supabase.from("quote_presets").select("id, nome, icone").eq("ativo", true).order("ordem")`.
- Ao salvar: faz `delete + insert` em `product_kit_presets` para o kit.
- Ao listar: faz join (`product_kit_presets` + `quote_presets`) e mostra os presets como badges em cada card de kit. Agrupamento por preset (um kit pode aparecer em vários grupos).

### 3. Hook `useProductKitProcesses`
Assinatura nova: `useProductKitProcesses({ presetId?: string; productKind?: string })`.
- Se `presetId` vier: busca kits via `product_kit_presets`.
- Senão: cai no comportamento atual (`product_kind`).
- Retorno permanece igual (`steps[]`).

### 4. Formulários de orçamento
Cada form que hoje passa string hardcoded (`BusinessCardForm`, `BookletForm`, `PrintForm`, `LabelEmbeddedForm`, `PrintAndProductForm`) recebe `presetId` opcional via props e o repassa ao hook. Mantém `productKind` como fallback para chamadas que ainda não passam preset.

`NewQuoteFormV3` (ou onde o preset é selecionado) passa `preset.id` para o form ativo.

### 5. Motor de Kit (`productKit.ts`)
`fetchActiveKitsForProduct` ganha overload `fetchActiveKitsForPreset(presetId)` que faz join via tabela de junção. Lógica de cálculo (`buildProductKitRows`) não muda.

### 6. Migração de dados
Para os kits existentes (hoje só `cartao_visita`/`apostila` etc.), gera vínculos automáticos no `product_kit_presets` mapeando `product_kind` → preset correspondente:
- `cartao_visita` → preset "Cartão de Visita"
- `apostila` → preset "Apostila"
- `etiqueta` → preset "Etiqueta"
- demais: ignora (admin re-vincula manualmente).

---

## Pontos de atenção

- **Banner e Lona** hoje usam o mesmo `form_tipo='cv'` mas são presets distintos. Com vínculo por preset, um kit "Ponteiras para banner" pode ser exclusivo do Banner sem aparecer em Lona — exatamente o que vínculo N:N permite.
- O campo `product_kind` continua na tabela apenas como legado (não removo para não quebrar migrações antigas). Pode ser limpo num passo futuro.
- Como qualquer preset pode ter 0 kits vinculados, mantenho o empty-state atual ("Crie um kit em Insumos → Kits de Produto").

---

## Arquivos afetados

- `supabase/migrations/<nova>.sql` — cria tabela + RLS + seed de vínculos a partir do `product_kind`.
- `src/pages/KitsProduto.tsx` — troca campo, salvar e listagem.
- `src/components/orcamentos-v3/shared/useProductKitProcesses.ts` — aceita `presetId`.
- `src/components/orcamentos-v3/shared/productKit.ts` — função `fetchActiveKitsForPreset`.
- `src/components/orcamentos-v3/forms/BusinessCardForm.tsx` e demais forms que usam o hook — recebem `presetId` por props.
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` — passa `preset.id` para o form ativo.

Confirma que posso seguir?