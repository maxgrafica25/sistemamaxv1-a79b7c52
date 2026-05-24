# Renomear "Tipo de formulário" → "Modo de cálculo" com microcopy

## Mudança
Em `src/pages/QuotePresets.tsx` (linhas 314–325), no diálogo de editar/criar favorito:

- Trocar `<Label>Tipo de formulário</Label>` por `<Label>Modo de cálculo</Label>`.
- Adicionar logo abaixo do Label um texto curto:
  ```
  <p className="text-xs text-muted-foreground mb-1">
    Define qual calculadora abre ao escolher este favorito no orçamento.
  </p>
  ```
- Manter os mesmos três valores no Select, com rótulos mais descritivos:
  - `Impressão` → `Impressão (papel + acabamentos)`
  - `Apostila` → `Apostila (miolo + capa)`
  - `Etiqueta` → `Etiqueta (layout em folha)`

## Fora de escopo
- Não alterar valores salvos no banco (`print` / `booklet` / `label`) nem o campo `form_tipo` no código.
- Não mexer em outros lugares que usam `form_tipo` (continuam funcionando igual).
