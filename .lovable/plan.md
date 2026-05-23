## Corrigir comportamento do checklist desativado

Hoje, quando "Confirmar checklist antes de salvar" está **desativado**, o `QuoteChecklistPanelV3` aparece na barra lateral do orçamento. Esse não é o comportamento esperado: desativado deve significar que o checklist **não aparece em lugar algum**.

### Comportamento desejado

- **Ativado (`checklist_before_save = true`)**: nada na sidebar; popup de revisão abre antes de salvar (como já está).
- **Desativado (`checklist_before_save = false`)**: nenhum checklist em lugar algum — nem sidebar, nem popup, nem etapa antes do save. Salvar vai direto.

### Mudança

Em `src/components/orcamentos-v3/NewQuoteFormV3.tsx`:

1. **Remover** o bloco condicional da sidebar (linhas ~345-352) que renderiza `<QuoteChecklistPanelV3>` quando `!checklist_before_save`. A sidebar nunca mais exibe o checklist.
2. Manter o popup (`Dialog`) e a checagem em `handleSave` exatamente como estão — só dispara quando `checklist_before_save = true` e há itens CV.
3. Remover o import de `QuoteChecklistPanelV3` se não for mais usado no popup (continua sendo usado dentro do `Dialog`, então mantém).

Nenhuma alteração em banco, `useGlobalSettings`, `Configuracoes.tsx`, `MobileCart` ou no componente `QuoteChecklist`.
