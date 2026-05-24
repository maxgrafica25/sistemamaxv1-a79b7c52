# Esconder Júlia no editor de orçamento

O botão fixo da Júlia (`AssistenteButton`, `position: fixed; right; bottom`) está sobrepondo o card "Total a cobrar" no canto inferior direito quando o orçamento é editado.

## Solução

Em `AssistenteButton.tsx`, ocultar o botão quando a rota for `/orcamentos-v3/novo` ou `/orcamentos-v3/:id/editar` (telas de edição). Uso `useLocation()` do react-router e um `if (isQuoteEditor) return null;` antes do render.

A Júlia continua acessível via Command Palette (Ctrl+K → "Falar com a Júlia") nessas telas.

## Arquivo afetado

- `src/components/assistente/AssistenteButton.tsx`
