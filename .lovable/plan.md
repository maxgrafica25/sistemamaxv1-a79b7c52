# Orçamento V2 — fluxo CV mais fluido + Assistente/Checklist claros

## Diagnóstico do que está travando hoje

Olhando o `NewQuoteFormV2` (bloco "Comunicação Visual"), `CVItemCard`, `QuoteAssistant` e `QuoteChecklist`:

1. **Início pesado.** Para criar o 1º item CV o usuário precisa:
   - rolar até o bloco recolhido "Comunicação Visual"
   - abrir o `<details>`
   - clicar "+ Item CV" (botão pequeno, canto direito)
   - escolher Mídia
   - escolher Impressão (mesmo quando só existe **uma** impressão compatível)
   - preencher Largura / Altura / Quantidade
   - abrir o popover "Adicionar" para cada acabamento, um por vez
   → São 6–8 cliques antes do primeiro preço aparecer.

2. **Dois botões "Adicionar" concorrendo.** O dropdown `+ Adicionar` da tabela principal e o `+ Item CV` do bloco CV ficam visualmente próximos e fazem coisas diferentes. Confuso.

3. **"Assistente do orçamento" e "Checklist do orçamento" não explicam o que fazem.** Aparecem como dois cartões soltos, com títulos vagos. O usuário não sabe se é IA, regra fixa, lembrete interno ou pergunta pro cliente.

---

## O que vamos mudar (só UI/UX, sem mexer em cálculo nem em IA)

### 1) Entrada única para itens CV
- Adicionar **"Comunicação Visual"** como 3ª opção do dropdown `+ Adicionar` que já existe em `QuoteItemsTable` (junto de "Impressão" e "Processo/Acabamento avulso"), com ícone `Megaphone`.
- Remover o botão duplicado `+ Item CV` de dentro do bloco CV. Manter só um `+ outro item` discreto no rodapé do bloco depois que já existe ≥ 1 item.
- O bloco CV deixa de ser `<details>` recolhido por padrão **quando há ≥ 1 item**; permanece recolhível, mas inicia aberto após criação.

### 2) Auto-seleção e defaults inteligentes no `CVItemCard`
- Ao criar item: se a empresa tem só uma Mídia padrão (ou a última usada nesse orçamento), pré-seleciona.
- **Auto-selecionar Impressão** quando só existe 1 compatível com a mídia escolhida (hoje força clique no segundo `Select`). Mostrar a impressão escolhida como chip "Impressa em: X · trocar".
- Foco inicial direto no campo **Largura**. Tab natural: Largura → Altura → Quantidade.
- Quantidade default = 1 (já é), mas placeholder visível "Qtd".

### 3) Acabamentos em 1 clique
- Acima do botão "Adicionar" do `CVItemCard`, mostrar até **4 chips dos acabamentos mais usados para aquele `tipo_midia`** (vem do `historical-suggestions`/`acabamentos` mais frequentes). Clicar no chip aplica direto sem abrir popover.
- O popover "Adicionar" continua existindo para os demais, mas agora é exceção, não regra.

### 4) Cartão "Inteligência do orçamento" — unificar Assistente + Checklist
Substituir os dois cartões soltos por **um cartão único** com 2 abas internas:

```text
┌─ Inteligência do orçamento ──────────────────────────┐
│ [ Sugestões (3) ] [ Perguntas pendentes (1) ]        │
│ ────────────────────────────────────────────────────  │
│  conteúdo da aba selecionada                          │
└──────────────────────────────────────────────────────┘
```

- Aba **Sugestões** = atual `QuoteAssistant` (regras + histórico + IA), com subtítulo permanente:
  *"Analisa seus itens e aponta acabamentos esquecidos, riscos e perguntas úteis. Atualiza sozinho."*
- Aba **Perguntas pendentes** = atual `QuoteChecklist`, com subtítulo:
  *"Dúvidas que afetam o preço (ex.: cliente fornece arte? precisa instalação?). Responda para travar o valor correto."*
- Badges nas abas mostram contagem (sugestões ativas / perguntas não respondidas). Aba com pendência fica em destaque.
- Quando ainda não há itens CV: mostrar **estado vazio** explicando o que cada aba fará assim que houver itens — em vez do texto atual "Adicione itens CV para receber sugestões."

### 5) Microcópia e hierarquia
- Renomear botão `+ Item CV` → `+ Adicionar peça de comunicação visual` quando aparece dentro do bloco vazio.
- Tooltip no ícone `Megaphone` do header do bloco: "Lonas, adesivos, banners, placas — calculados por m²."
- Subtotal CV ganha texto auxiliar: "Inclui mídia + impressão + acabamentos."

---

## Onde mexer (técnico)

- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
  - linhas ~1680–1744: trocar `<details>` por `<Collapsible>` controlado, remover botão duplicado, montar novo cartão "Inteligência do orçamento" que internamente renderiza `QuoteAssistant` e `QuoteChecklist` em `Tabs`.
- `src/components/orcamentos-v2/QuoteItemsTable.tsx`
  - dropdown `+ Adicionar`: adicionar item "Comunicação Visual" que dispara um callback novo `onAddCV` (prop). `NewQuoteFormV2` passa o handler que hoje vive no botão "+ Item CV".
- `src/components/orcamentos-v2/CVItemCard.tsx`
  - auto-selecionar impressão única (`useEffect` sobre `compatImpressoes`).
  - chips de "acabamentos mais usados" (props nova `topFinishesForTipo: Record<string,string[]>`), populada por `NewQuoteFormV2` a partir do que já é buscado para o `QuoteAssistant`.
  - autofocus em Largura ao montar.
- `src/components/orcamentos-v2/QuoteAssistant.tsx` e `QuoteChecklist.tsx`
  - aceitar props `embedded?: boolean` para esconder o próprio header (título/ícone) quando renderizados dentro do cartão unificado.
  - expor `pendingCount` (Checklist) e `activeCount` (Assistant) via callback `onCountChange`, para os badges das abas.

Sem alteração em: `cv-calc/engine.ts`, regras determinísticas, edge function `quote-ai-assistant`, RLS, schema, persistência, cálculo de preço, multiplicadores.

---

## Resultado esperado

- Criar 1 item CV completo: **3 cliques** (Adicionar → CV → digitar dimensões) contra ~7 hoje.
- Assistente e Checklist viram **uma coisa só** com nomes que explicam função.
- Bloco CV deixa de competir com 2 botões "Adicionar".

Pronto pra implementar quando aprovar.
