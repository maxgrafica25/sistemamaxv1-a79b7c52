## Objetivo

Facilitar a escolha de papel no orçamento (`PrintForm` → `PrintingItemSearch`) usando as categorias **Comum / Especial / Adesivo** já cadastradas em `papers.category`. Mantém a busca textual atual; categoria é triagem opcional.

## UX

```text
┌──────────────────────────────────────────────────────┐
│ [ Todos · 24 ] [ Comum · 11 ] [ Especial · 8 ] [ Adesivo · 5 ] │
│ 🔎 Buscar papel (nome, tamanho, impressora)...        │
└──────────────────────────────────────────────────────┘
   ▼ Dropdown
   ── Especial ──────────────────
   • Couchê 300g — SRA3 F      R$ 1,20/folha
   • Supremo 250g — A3 F        ...
   ── Comum ─────────────────────
   • Offset 90g — A4 F          ...
```

- Chip ativo padrão: **Todos**. Clicar num chip restringe os resultados do combobox.
- Contador no chip mostra quantos itens do catálogo caem na categoria (após dedup por nome+gramatura via `papers`).
- Dentro do dropdown, resultados ficam agrupados por categoria com header sticky leve. Se o usuário já filtrou por chip, só aparece aquele grupo (sem header redundante).
- Busca textual continua funcionando em qualquer aba — se o termo bate em item fora da categoria escolhida, mostra uma linha discreta no final: *"+3 resultados em outras categorias — Ver todos"* (clicar volta pra "Todos").
- Pré-seleção automática: quando o usuário entra no `PrintForm` via um **produto favorito** que tenha `papel_inclui` apontando majoritariamente para uma categoria, o chip dessa categoria já vem ativo. Sem favorito ou ambíguo → "Todos".

## Implementação técnica

### 1. Carregar categorias dos papéis

Hoje `useV3Catalog` traz `items: PrintingCatalogItem[]` (do `printing_price_items`) sem categoria. Vamos:

- Em `useV3Catalog` (ou query paralela em `PrintingItemSearch`), buscar `papers` com `name, grammage, category`.
- Anexar `category: "comum" | "especial" | "adesivo" | null` em cada `PrintingCatalogItem`, casando por `paper_type` + `grammage` (mesma regra de dedup já usada).
- Default quando não há match: `null` (cai no balde "Outros" — mostrado só se `null` existir; do contrário, oculto).

### 2. `PrintingItemSearch` ganha chips + agrupamento

- Novo estado interno `categoryFilter: "all" | "comum" | "especial" | "adesivo"`.
- Render: barra de chips acima do `Input`, com contadores derivados de `items` (memo).
- `filtered` passa a aplicar: `categoryFilter === "all" || item.category === categoryFilter`, **depois** filtro textual.
- Agrupamento: `useMemo` que monta `Map<category, items[]>` na ordem `["especial","comum","adesivo","outros"]`. Render percorre grupos não-vazios e injeta um header `<div class="sticky top-0 ...">` antes dos botões. Se `categoryFilter !== "all"`, pula headers.
- Linha "+N em outras categorias" no fim do dropdown quando há `search` ativo, `categoryFilter !== "all"`, e existem matches fora do filtro.

### 3. Props para pré-seleção

`PrintingItemSearch` aceita `defaultCategory?: "comum" | "especial" | "adesivo" | null`. `PrintForm` calcula esse hint a partir de um novo prop `suggestedCategory?` que `PrintAndProductForm` repassa quando há `selectedPreset?.papel_inclui` apontando para uma única categoria predominante (lookup contra a mesma tabela `papers` já em memória nos presets — passar via prop ou query leve aqui).

### 4. Sem mudanças de schema, sem mudanças em `quote_presets`

A coluna `papers.category` já existe (migração anterior). Tudo é frontend.

## Arquivos editados

- `src/components/orcamentos-v3/shared/useV3Catalog.ts` — incluir join/lookup de `papers.category` em cada `PrintingCatalogItem`.
- `src/components/orcamentos-v3/shared/PrintingItemSearch.tsx` — chips, agrupamento, contador, prop `defaultCategory`.
- `src/components/orcamentos-v3/forms/PrintForm.tsx` — repassar `suggestedCategory` ao `PrintingItemSearch`.
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — derivar categoria sugerida a partir do `selectedPreset.papel_inclui` (consulta única à lista de `papers` já carregada para `QuotePresets`, ou query simples reutilizando `useV3Catalog`).

## Fora de escopo

- Aplicar o mesmo na aba CV ou Calculadora de Etiquetas (só Impressão por enquanto, como antes).
- Editar `papers.category` em massa (continua um a um em Matérias-Primas).
- Persistir a última categoria escolhida pelo usuário (sessão começa sempre em "Todos" ou na sugerida pelo favorito).

## Validação manual

1. Abrir **novo orçamento → Impressão (Personalizado)**: ver 4 chips com contadores corretos.
2. Clicar em **Especial**: combobox mostra só couchês/supremos/etc., sem headers de grupo.
3. Voltar para **Todos** e digitar "couch": resultados agrupados, "Especial" no topo.
4. Selecionar favorito "Folheto Couchê" (cuja papel_inclui é só de papéis Especiais): chip **Especial** já entra ativo.
5. Selecionar favorito misto (papel_inclui em múltiplas categorias): chip continua em "Todos".
6. Digitar termo que só bate em "Comum" estando em "Especial": aparece linha "+N em outras categorias".
