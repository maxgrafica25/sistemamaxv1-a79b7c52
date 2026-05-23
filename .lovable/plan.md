# Remover input "Nome do acabamento" no Kit Encadernação

## Contexto
No `BookletKitPanel.tsx`, ao clicar em "Adicionar acabamento", abre-se um slot em modo edição com **duas barras**:
1. Input "Nome do acabamento"
2. Busca de suprimento

Como o nome do suprimento selecionado já vira o label (`slot.label.trim() || slot.supply.produto`), o primeiro input é redundante.

## Mudanças (apenas UI no `BookletKitPanel.tsx`)

1. **Remover** o bloco do input "Nome do acabamento" (linhas 434–451), mantendo só o ícone Sparkles + botão de remover slot ao lado da busca.
2. **Mover** o botão de remover slot para a linha do `SupplySearch` (ou manter como header compacto).
3. No `onSelect` do `SupplySearch` (linha 455), também setar `label: s.produto` para preencher automaticamente.
4. Manter o fallback `slot.label.trim() || slot.supply.produto` na vista colapsada (já funciona).

## Fora do escopo
- Nenhuma mudança em lógica de preço/quantidade.
- Não mexer no `ProductKitPanel` nem nos demais forms.
