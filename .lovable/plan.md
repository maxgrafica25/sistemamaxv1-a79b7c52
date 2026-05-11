# Refinamento do bloco de Apostila

## Mudança semântica

O input passa a representar **folhas físicas por apostila** (não "páginas"). F/V apenas dobra as **impressões**, não muda o número de folhas. O termo "página" é removido por completo desta interface para evitar confusão com a contagem de páginas do PDF do cliente.

### Exemplo (50 folhas × 10 apostilas, F/V)
- Folhas físicas totais: 50 × 10 = **500 folhas**
- Impressões totais: 500 × 2 (F/V) = **1.000 impressões**
- Folhas SRA3 cobradas (A4 = 2 un/folha SRA3): `ceil(500 / 2) = 250 folhas SRA3`

## Item 1 — Corrigir cálculo (`PrintingItemEditor.tsx`)

Substituir a fórmula nos 3 handlers (folhas, apostilas, toggle F/V):

**Antes:**
```ts
const folhasPorAp = Math.ceil(pgs / (bookletDuplex ? 2 : 1));
const pieces = folhasPorAp * units;
```

**Depois:**
```ts
// 'sheets' = folhas físicas por apostila (input direto do usuário)
const pieces = sheets * units;
const impressoes = pieces * (bookletDuplex ? 2 : 1); // só para exibição
```

`pieces` continua alimentando `calcSheetYield`. O campo persistido `bookletPages` mantém o nome no schema (sem migração), mas a interpretação no front muda para "folhas por apostila".

## Item 2 — Layout do bloco (`PrintingItemEditor.tsx`)

Bloco dedicado próprio, abaixo de "Capa & Contracapa" e acima da linha de cadeado/peças. Sem o termo "página" em nenhum rótulo.

```text
┌─ Configuração da Apostila ─────────────────────────────┐
│  Folhas por apostila      Quantidade de apostilas      │
│  [    50    ]              [    10   ]                 │
│                                                        │
│  Impressão:  ( Frente )  [● Frente e Verso ]           │
│                                                        │
│  Resumo: 50 folhas × 10 apostilas · F/V                │
│         → 500 folhas físicas · 1.000 impressões        │
└────────────────────────────────────────────────────────┘
```

Detalhes:
- 2 inputs com `<Label>` completos acima ("Folhas por apostila" / "Quantidade de apostilas").
- Toggle F/V em par de botões segmentados destacados ("Frente" / "Frente e Verso") com label "Impressão".
- Linha de resumo em texto pequeno mostrando folhas físicas e impressões totais em tempo real.

Na linha "Peças desejadas / Aprovado":
- Em modo apostila, **remover** os 3 inputs inline.
- Manter apenas: ícone de status + label "Folhas a imprimir" + valor calculado (read-only) + preço total + ações (régua/remover).

## Item 3 — Linha derivada "Usa N folhas"
Mantida como está (alimentada por `pieces` → `calcSheetYield`). Bate com a nova semântica.

## Out of scope
- `pricing.ts`, schema, `calcSheetYield`, capa/contracapa.
- Persistência: campo `booklet_pages` mantém o nome no banco; só muda o significado/UI.

## Arquivo único editado
- `src/components/orcamentos-v2/PrintingItemEditor.tsx`
