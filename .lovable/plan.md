
# Unificar Apostilas + Etiquetas na aba Impressão + Acabamentos (V3)

## Objetivo
- Reduzir o número de abas no V3 colocando "Apostilas" e "Etiquetas" como **modos de produto** dentro da aba **Impressão + Acabamentos**.
- Introduzir um seletor **Produto | Personalizado** no topo do formulário.
- Adicionar sugestão inteligente: se o usuário escolher uma combinação típica (ex.: papel "lona" + acabamento "ilhós"), o sistema sugere o produto correspondente e o usuário confirma com 1 clique.

## Mudanças visuais

```text
Abas: [Impressão + Acabamentos]  [Com. Visual]  [Terceirizados]  [Mão-de-obra]  [Suprimentos]
                                       (Apostilas e Etiquetas saem da barra de abas)

Dentro da aba Impressão + Acabamentos:
┌─────────────────────────────────────────────────────────────┐
│  Modo:  ( ◉ Personalizado )  ( ○ Produto )                  │
│                                                             │
│  [ se Produto ] Chips:                                      │
│     [ Folheto ] [ Cartão Visita ] [ Apostila ]              │
│     [ Banner ]  [ Etiqueta ]      [ Adesivo ]               │
│                                                             │
│  [ formulário muda conforme modo+produto ]                  │
│                                                             │
│  💡  Sugestão: "Parece um Banner — aplicar preset?"  [Aplicar]│
└─────────────────────────────────────────────────────────────┘
```

- **Personalizado**: formulário atual de impressão (`PrintForm`) sem alterações.
- **Produto = Apostila**: reutiliza o conteúdo de `BookletForm` (miolo + folhas/apostila + F/V + espiral).
- **Produto = Etiqueta**: abre a Calculadora de Etiquetas completa em um painel embutido (porta de `LabelLayoutCalculator`) e, ao confirmar, adiciona como item de impressão com snapshot de aproveitamento, acabamentos e preço.
- **Produto = Folheto / Cartão / Banner / Adesivo**: presets leves que pré-preenchem catálogo, quantidade típica e acabamentos sugeridos no `PrintForm` (não exigem componente novo).

## Sugestão inteligente (não intrusiva)

Regras simples avaliadas sempre que o usuário altera catálogo ou acabamentos no modo Personalizado:

| Gatilho                                                        | Sugestão       |
|----------------------------------------------------------------|----------------|
| `paper_type` contém "lona" / "vinil" + acabamento ilhós/bastão | Banner         |
| Acabamento "wire-o" ou "espiral" + páginas > 1                 | Apostila       |
| Acabamento "corte especial" + tamanho pequeno (<A5)            | Etiqueta       |
| `paper_type` contém "adesivo"                                  | Adesivo        |
| `paper_type` "couchê 250g+" + tamanho cartão                   | Cartão Visita  |

A sugestão aparece como faixa discreta acima do botão "Adicionar". Botão **Aplicar** troca o modo para Produto + chip correspondente preservando o que já foi preenchido. Botão **Dispensar** esconde a sugestão até a próxima mudança relevante.

## Arquivos afetados

**Editar**
- `src/components/orcamentos-v3/workspace/TabsLayout.tsx` — remover abas `booklet` e adicionar nada (etiqueta nunca existiu como aba). Atualizar atalhos Alt+N.
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` — remover roteamento de `booklet`; o caso `print` passa a renderizar o novo `PrintAndProductForm`. Atualizar mapa de atalhos.
- `src/components/orcamentos-v3/types.ts` — manter `V3BookletItem` (continua sendo o tipo persistido quando o produto é Apostila). Adicionar `V3LabelItem` para etiqueta com snapshot vindo da calculadora.
- `src/components/orcamentos-v3/shared/saveQuoteV3.ts` — adicionar branch para `kind === "label"` persistindo metadados de aproveitamento como `quote_print_items` + acabamentos.

**Criar**
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — wrapper com toggle Produto/Personalizado + chips de produto. Roteia para `PrintForm`, `BookletForm` ou `LabelEmbeddedForm`.
- `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx` — embute `LabelLayoutCalculator` em modo "quote" (callback `onConfirm(snapshot)` em vez de salvar favorito) e converte o resultado em `V3LabelItem`.
- `src/components/orcamentos-v3/shared/productPresets.ts` — definições dos 6 presets (folheto, cartão, apostila, banner, etiqueta, adesivo) com filtros do catálogo, quantidade default e acabamentos sugeridos.
- `src/components/orcamentos-v3/shared/productSuggester.ts` — função pura que recebe `(catalog, finishings)` e devolve `{ productId, confidence } | null` aplicando as regras da tabela acima.

**Remover do menu (mas manter o arquivo)**
- `BookletForm.tsx` continua existindo, agora consumido por `PrintAndProductForm` em vez da aba antiga.

## Detalhes técnicos

- A Calculadora de Etiquetas (`LabelLayoutCalculator`, ~1790 linhas) será **incluída como componente**, não duplicada. Adicionar uma prop opcional `embeddedMode?: { onConfirm: (snapshot) => void; onCancel: () => void }` que, quando presente, oculta o botão "Salvar favorito"/PDF e exibe "Adicionar ao orçamento" — sem mexer na lógica interna.
- O snapshot do label inclui: `sheet_size`, `labels_per_sheet`, `quantidade_etiquetas`, `paper_catalog_item_id`, `finishings[]`, `production_minutes`, `custo_total`, `preco_total`. Persistido em `quote_print_items` com a coluna `descricao` enriquecida ("Etiqueta 50×30mm — 5000 un").
- Atalhos de teclado: Alt+1 segue para "Impressão + Acabamentos"; Alt+2 CV, Alt+3 Terceirizados, Alt+4 Mão-de-obra, Alt+5 Suprimentos. Apostila/Etiqueta acessíveis por chips dentro de Alt+1.
- Persistência de rascunho (`useQuoteDraftV3`) não muda — o estado novo do toggle vive só dentro de `PrintAndProductForm`.

## Fora de escopo
- Não tocar em `PrintForm`, `BookletForm` (a não ser ajustar a assinatura de props se necessário), `LabelLayoutCalculator` (apenas adicionar prop opcional).
- Não mexer em CV, Terceirizados, Mão-de-obra, Suprimentos.
- Não alterar a página `/etiquetas` standalone — ela continua funcionando.

## Validação após implementação
1. Abrir `/orcamentos-v3/novo`, conferir 5 abas (sem Apostilas).
2. Em Impressão + Acabamentos, alternar Produto/Personalizado.
3. Adicionar 1 item de cada produto (folheto, cartão, apostila, banner, etiqueta, adesivo) e conferir o carrinho.
4. No modo Personalizado, selecionar lona + ilhós e confirmar que a faixa de sugestão "Banner" aparece.
5. Salvar orçamento e abrir em `/orcamentos-v2` para verificar que tudo carrega.
