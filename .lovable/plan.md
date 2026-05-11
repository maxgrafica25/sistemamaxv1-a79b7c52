## Objetivo

Sugerir automaticamente o conteúdo do campo **Assunto / Projeto** com base nos itens já lançados na proposta, sem nunca sobrescrever texto digitado pelo vendedor.

Formato escolhido: **só produto(s)**.
Comportamento escolhido: **sugestão visível + botão "Usar sugestão"** (nunca preenche silenciosamente).

## Comportamento detalhado

1. Enquanto o campo `product` (Assunto / Projeto) estiver **vazio**:
   - Mostrar a sugestão como `placeholder` dinâmico em tempo real, conforme o vendedor adiciona/edita itens.
   - Se houver pelo menos 1 item com `productKind` preenchido, exibir um chip discreto à direita do label: `Usar sugestão: "Cartão de visita + Panfleto"` que, ao clicar (ou pressionar `Tab` no input vazio), preenche o campo.
2. Se o campo já tiver qualquer texto digitado:
   - Não sobrescrever, não mostrar mais o chip de sugestão automaticamente.
   - Mostrar um pequeno ícone `↻` (RefreshCw) ao lado do label, com tooltip "Regenerar a partir dos itens", para o usuário voltar ao automático manualmente.
3. Placeholder padrão (quando ainda não há itens): manter o atual `Ex.: Cartões de visita corporativos – Acme Ltda.`.

## Fórmula da sugestão (formato "só produto(s)")

A partir do array `materials` (root items, `parent_material_id == null`):

- Coletar `productKind` de cada item raiz; ignorar nulos/vazios; remover duplicatas mantendo ordem.
- 1 tipo único → `Cartão de visita`
- 2 tipos → `Cartão de visita + Panfleto`
- 3+ tipos → `Cartão de visita + Panfleto + 2 outros` (junta os 2 primeiros e resume o resto)
- Se nenhum item tiver `productKind`: não há sugestão (chip e placeholder dinâmico não aparecem; placeholder padrão segue exibido).
- Truncar em 80 caracteres com `…`.

## Arquivos a alterar

1. **Novo** `src/lib/quotes-v2/subject-suggestion.ts`
   - Função pura `buildSubjectSuggestion(materials: PricingMaterial[]): string` implementando a fórmula acima.
   - Função `pickProductKinds(materials)` auxiliar (filtra root items, remove duplicatas, preserva ordem).

2. **Editar** `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
   - Importar `buildSubjectSuggestion`.
   - Calcular `subjectSuggestion = useMemo(() => buildSubjectSuggestion(materials), [materials])`.
   - No bloco do label "Assunto / Projeto *" (linhas ~1099–1107):
     - Renderizar chip `Usar sugestão: "..."` ao lado do label quando `!product.trim() && subjectSuggestion`.
     - Renderizar ícone `↻` quando `product.trim() && subjectSuggestion && product !== subjectSuggestion`.
     - No `<Input>`: trocar `placeholder` por `subjectSuggestion || "Ex.: Cartões de visita corporativos – Acme Ltda."`.
     - Adicionar `onKeyDown` capturando `Tab` quando o campo está vazio e há sugestão → preencher e deixar o foco seguir o Tab natural.

## Fora de escopo

- Nenhuma mudança em pricing, persistência ou schema. O valor final salvo continua sendo exatamente o que está em `product` no momento do `Salvar`.
- Não alterar regra de campo obrigatório — o `*` permanece e a validação atual segue valendo.
- Sem mudanças no `generated_title` por item (esse é outro título, intra-item).
