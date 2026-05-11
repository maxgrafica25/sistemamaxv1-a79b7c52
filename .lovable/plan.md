# Refatoração da Proposta Comercial (PrintingItemEditor)

Foco: reduzir cliques e carga cognitiva no editor de item de impressão (`src/components/orcamentos-v2/PrintingItemEditor.tsx`) e seu sub-bloco de acabamentos.

## 1. Cabeçalho e limpeza visual

- Manter campo **"Assunto / Projeto"** no formulário pai (`NewQuoteFormV2.tsx`) — sem alterações.
- No banner do título dinâmico do item, **remover** o texto instrucional longo *"Preencha tipo de material, dimensões, cor e papel para gerar a descrição."* Quando o título estiver vazio, exibir apenas um placeholder discreto: *"Título gerado automaticamente"* (uma linha, baixo contraste).
- Remover a linha "Catálogo: …" (informação redundante quando o papel já aparece selecionado abaixo).

## 2. Configuração do item

### 2.1 Papel — Autocomplete real

O campo "Papel" hoje é um Popover com botão + Command (já tem busca). Manter a mecânica de busca, mas:
- Trocar o trigger (botão tipo Select) por um `<Input>` direto com `placeholder="Buscar papel, gramatura, formato…"`.
- Ao focar, abrir a lista de sugestões (filtradas pelo texto digitado em tempo real).
- Quando um papel está selecionado, mostrar o resumo dentro do próprio input (label compacto + botão `X` para limpar).
- Sem botão `ChevronDown` — comportamento puro de combobox autocomplete.

### 2.2 Variações de tiragem ("Ancoragem de Preço")

Hoje cada item tem **um** input de "Peças desejadas" e o preço total é calculado para essa quantidade.

Adicionar conceito de **variações de tiragem** dentro do mesmo item:

- Manter o input principal de "Peças desejadas" (variação primária, sempre presente).
- Logo abaixo, botão ghost **`+ Adicionar variação`**.
- Ao clicar, renderizar uma nova linha compacta com:
  - Input "Peças" (numérico)
  - Valor unitário/total recalculado automaticamente para essa quantidade (usando a mesma lógica `recalculateForQuantity` já existente em `src/lib/quotes-v2/pricing.ts`)
  - Botão `X` para remover a variação
- As variações ficam apenas para **exibição comparativa** (ancoragem de preço na proposta). Não alteram o preço base do item — apenas dão ao cliente cenários (100, 500, 1000 peças).
- Persistência: nova coluna em `quote_materials` chamada `quantity_variations jsonb` (array de `{ pieces: number, unit_price: number }`). Migração necessária.
- No PDF / ClientViewer, renderizar essas variações em uma pequena tabela "Tiragens disponíveis" abaixo do item.

## 3. Bloco de Acabamentos — refatoração completa

Substitui o trecho atual "Acabamentos vinculados" (`PrintingItemEditor.tsx` linhas 592-641) e o `LaborAndSupplySubform` em modo `compact`.

Novo componente: `src/components/orcamentos-v2/SmartFinishingBlock.tsx`

### 3.1 Camada 1 — Chips contextuais

- Logo abaixo do título "Acabamentos", uma faixa horizontal de **chips ghost** sugeridos.
- Sugestões derivadas de:
  - **Mapeamento por productKind** (definido em `src/lib/quotes-v2/finishing-suggestions.ts`):
    - `Panfleto / Folder` → Refile, Vinco, Dobra
    - `Cartão de Visita` → Refile, Laminação, Cantos arredondados
    - `Adesivo / Etiqueta` → Refile, Recorte
    - `Bloco / Talão` → Colagem, Numeração, Picote
    - default → Refile, Colagem, Embalagem
  - Cruzar com `processSteps` reais (cadastrados) para resolver IDs/tempos.
- Cada chip: `[+ Refile]` em estilo ghost com borda tracejada, ícone `Plus`. Click adiciona instantaneamente a linha no grid abaixo (sem abrir popover).
- Chips já adicionados ficam ocultos da faixa (ou marcados como ✓ desabilitados).

### 3.2 Camada 2 — Omnibox

- Um único `<Input>` largo, full-width, com `placeholder="Buscar ou criar novo acabamento…"`.
- Ao digitar:
  - Lista dropdown abaixo filtra `processSteps` (cadastrados) por descrição.
  - Se zero resultados, exibe **`+ Criar "[texto]"`** como única opção.
- Click em resultado existente → adiciona linha pré-preenchida (descrição + tempo do cadastro).
- Click em "Criar …" → adiciona linha com nome preenchido, tempo = 0, e **auto-focus no input de "min"** dessa nova linha (sem modal, sem popover). Usa `requestAnimationFrame` + `ref` no novo input.

### 3.3 Remover

- Botões soltos "Mão de obra" / "Material" / "Acabamento avulso" / "Grupo (M.Obra)" / "Grupo (Material)" do `LaborAndSupplySubform` em modo `compact`.
- Botão `+ Adicionar Processo` (ProcessPicker) no header do bloco.
- Manter `LaborAndSupplySubform` para o uso não-compact (Bloco 3 — itens avulsos do orçamento), apenas alterar o branch `compact={true}` para usar o novo `SmartFinishingBlock`.

## 4. Acabamentos opcionais (upsell)

- Adicionar coluna `is_optional boolean default false` em `quote_labor_steps` e `quote_materials` (migração). Atualizar tipo `SubformLabor` e `SubformMaterial`.
- Em cada linha de acabamento renderizada, no final (antes do botão `X`):
  - `<Switch>` shadcn com label `Opcional` (texto pequeno, `text-[11px]`).
- Quando `is_optional === true`:
  - Aplicar `bg-amber-50 dark:bg-amber-950/20 border-amber-300/40` na linha.
  - Adicionar badge `Opcional` discreto à esquerda da descrição.
- Cálculo: filtrar opcionais ao somar custos do item base. Já existe `calculateMaterialCost` / `calculateLaborCost` em `src/lib/quotes-v2/pricing.ts` — adicionar parâmetro `{ excludeOptional: true }` (default true para o preço base, false para o "preço com opcionais" exibido como segunda linha de upsell na proposta).
- ClientViewer / PDF: listar opcionais em seção separada "Adicionais sugeridos" com preço destacado.

## Detalhes técnicos

### Arquivos novos
- `src/components/orcamentos-v2/SmartFinishingBlock.tsx` — chips + omnibox + lista de linhas com toggle opcional.
- `src/lib/quotes-v2/finishing-suggestions.ts` — mapa `productKind → string[]` e helper que resolve para `ProcessStep[]` reais.

### Arquivos editados
- `src/components/orcamentos-v2/PrintingItemEditor.tsx`
  - Banner do título: remover texto longo (linhas 232-237) e linha "Catálogo:" (238-242).
  - Campo Papel: trocar trigger por Input combobox (linhas 376-457).
  - Quantidade: adicionar UI de variações abaixo do input principal (linhas 482-554).
  - Bloco final (592-641): substituir por `<SmartFinishingBlock parentItemId={item.id} ... />`.
- `src/components/orcamentos-v2/LaborAndSupplySubform.tsx`
  - Adicionar `isOptional` nas interfaces `SubformLabor`/`SubformMaterial` e propagação.
  - Continuar usado em modo não-compact (Bloco 3 avulso).
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
  - Carregar `is_optional` do banco; passar/persistir; ajustar somatórios para excluir opcionais do preço base.
- `src/lib/quotes-v2/pricing.ts`
  - `recalculateForQuantity` e helpers de soma: ignorar itens com `isOptional` no preço base; expor função para somar adicionais opcionais separadamente.
- `src/pages/orcamentos-v2/ClientViewer.tsx`
  - Renderizar variações de tiragem e seção "Adicionais sugeridos" com opcionais.

### Migração SQL
```sql
ALTER TABLE public.quote_materials
  ADD COLUMN is_optional boolean NOT NULL DEFAULT false,
  ADD COLUMN quantity_variations jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.quote_labor_steps
  ADD COLUMN is_optional boolean NOT NULL DEFAULT false;
```

### Fora de escopo
- Não alterar o fluxo de Comunicação Visual (`CVItemCard`).
- Não mudar o cálculo de preço base por folha (apenas excluir opcionais do somatório).
- Não mexer em pedidos / OP — opcionais ficam só no orçamento até serem aprovados explicitamente.

## Pontos a confirmar antes de implementar

1. **Variações de tiragem**: confirma que são apenas exibição/ancoragem (cliente vê 3 preços, escolhe 1 ao aprovar) e não geram itens separados no pedido?
2. **Mapeamento de chips por productKind**: o mapa proposto (Panfleto→Refile/Vinco/Dobra etc.) cobre seu uso, ou prefere que eu puxe sugestões dinamicamente dos processos mais usados historicamente naquele tipo de produto?
3. **Opcionais no PDF**: seção separada "Adicionais sugeridos" com preço somado, ou inline com badge "+R$ X opcional"?
