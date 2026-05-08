# Correção: fazer o card novo aparecer de cara

## Diagnóstico real

O `QuoteItemsTable` **já renderiza** o `PrintingItemEditor` corretamente em `renderPrint` (linhas 168-226) e o botão **"+ adicionar impressão"** (linha 380) já chama `onAddEmptyPrinting()`. O componente novo não está órfão.

O que o usuário vê na tela é o **DraftRowEditor legado**, que ainda contém a barra `"Busque a impressão pelo nome (papel, gramatura, formato)…"` (linha 513). Ele aparece porque, ao entrar em um orçamento vazio, o `useEffect` de auto-draft (linhas 107-121) chama `addEmptyDraft()` automaticamente, abrindo o editor antigo.

Resultado: o usuário nunca clica no "+ adicionar impressão" — o draft antigo já aparece sozinho e ocupa a tela.

## O que vou alterar

### 1. `QuoteItemsTable.tsx` — trocar o auto-draft pelo card novo
- No `useEffect` das linhas 107-121, substituir `addEmptyDraft()` por `onAddEmptyPrinting()`. Assim, ao abrir um orçamento em branco, já aparece um `PrintingItemEditor` vazio (Tipo / L / A / Cor / Papel) pronto para preencher — sem passar pela busca legada.
- Manter o `DraftRowEditor` disponível **apenas** pelo botão secundário "+ processo / acabamento avulso" (linha 386), que continua sendo o caminho legado para acabamentos soltos.

### 2. Verificação visual
- Após a edição, abrir `/orcamentos-v2/novo` no preview e confirmar que:
  - A barra "Busque a impressão pelo nome…" **não aparece** mais ao entrar.
  - Em seu lugar, aparece imediatamente o card do `PrintingItemEditor` com os campos estruturados (Tipo, Largura, Altura, Cor, Papel) e o badge cinza de rendimento.
  - O botão "+ adicionar impressão" continua adicionando novos cards.

## Fora do escopo
- Não vou remover `DraftRowEditor` nem `InlineCatalogCombobox` agora — eles ainda servem ao fluxo de "processo / acabamento avulso".
- Sem mudanças em `PrintingItemEditor.tsx`, `NewQuoteFormV2.tsx`, `pricing.ts`, `sheet-yield.ts` ou banco.

## Arquivos a editar
- `src/components/orcamentos-v2/QuoteItemsTable.tsx` (1 alteração no `useEffect` de auto-draft)
