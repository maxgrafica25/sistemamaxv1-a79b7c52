## Remover redirects legacy de orçamentos

Em `src/App.tsx`, apagar as 3 rotas de redirect que ainda existem por compatibilidade:

- `/orcamentos-v2` → `/orcamentos`
- `/orcamentos-v2/*` → `/orcamentos`
- `/orcamentos-v3` → `/orcamentos`

A partir disso, qualquer acesso a essas URLs cairá no `NotFound`. As rotas ativas continuam funcionando normalmente:

- `/orcamentos` (lista)
- `/orcamentos-v3/novo` (criar)
- `/orcamentos-v3/:id/editar` (editar)
- `/p/:quoteNumber` (viewer público — link compartilhado com cliente)

Nenhuma outra mudança: sidebar, command palette e todos os botões internos já apontam para as rotas ativas.
