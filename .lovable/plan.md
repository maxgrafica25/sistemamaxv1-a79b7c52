# Lançamento inteligente de compras tipo "Caixa com N pacotes de M folhas"

## Problema

Hoje, quando você marca **"Comprado já cortado"** (ex.: Sulfite A4) e compra uma caixa Suzano (10 pacotes × 500 folhas = 5.000 folhas, R$ 2.237,17), você precisa fazer a conta de cabeça antes de digitar:

- Qtd. Folhas na resma = **5.000**
- Preço do Pacote = **2.237,17**

Isso é fonte de erro (esqueceu um zero, contou pacotes errado) e não deixa rastro de **como** o custo unitário foi formado.

## Solução proposta — apenas UI no diálogo de cadastro de papel

Adicionar um bloco opcional **"Modo embalagem"** que aparece somente quando `paperIsCutSize` está marcado, logo acima dos campos `Qtd. Folhas` / `Preço do Pacote`.

### Novo bloco "Como você comprou?"

Toggle (Switch) com 2 modos:

**1. Simples (atual)** — campos `Qtd. Folhas na resma` + `Preço do Pacote` editáveis manualmente. Comportamento idêntico ao de hoje.

**2. Embalagem** — exibe 3 campos lado a lado:

```text
┌──────────────┬──────────────┬─────────────────────┐
│ Caixas       │ Pacotes/cx   │ Folhas/pacote       │
│   1          │   10         │   500               │
└──────────────┴──────────────┴─────────────────────┘
┌──────────────────────────────────────────────────┐
│ Preço total da compra (R$)   2.237,17            │
└──────────────────────────────────────────────────┘
```

Mais um preview compacto:

```text
1 cx × 10 pct × 500 fl  =  5.000 folhas
Custo por folha (sem frete): R$ 0,4474
```

Ao mudar qualquer um dos 4 campos, o componente preenche automaticamente os campos existentes:
- `paperSheetQty`  ← `caixas × pacotes × folhasPorPacote`
- `paperPackPrice` ← `precoTotalCompra`

Os campos antigos continuam visíveis (read-only no modo Embalagem) para o usuário ver o resultado e ainda poder voltar para o modo Simples.

### Defaults inteligentes
- Caixas = 1, Pacotes = 1, Folhas/pacote = 500 (resma típica de sulfite).
- Foco automático em "Preço total" — quase sempre o único valor que muda compra a compra.

### Por que só no modo "cortado"?
O modo folhão (66×96 / SRA3) já tem semântica diferente (Qtd. de folhões grandes), e raramente é vendido em caixas-de-pacotes. Mantemos esse fluxo intacto.

## Fora de escopo

- Não persiste `caixas/pacotes/folhasPorPacote` no banco (pure UI helper). Se mais tarde quisermos histórico de embalagem, adicionamos colunas opcionais.
- Não mexe no cálculo de preço de impressão, no frete, nem no listing.
- Não mexe em Suprimentos.

## Detalhes técnicos

- Arquivo único: `src/pages/MateriasPrimas.tsx`.
- 3 estados locais novos: `pkgBoxes`, `pkgPacks`, `pkgSheetsPerPack` + 1 toggle `pkgMode: "simple" | "package"`.
- Reset dos estados ao abrir/fechar o diálogo (junto com os resets já existentes).
- `useEffect` que, em `pkgMode === "package"`, recomputa `paperSheetQty` quando os 3 fatores mudam.
- O campo "Preço total da compra" reusa o mesmo state `paperPackPrice` (renomeamos só o label visualmente quando em modo embalagem para "Preço total da compra (R$)").
