# Ações rápidas no editor de orçamento

Hoje os botões **Gerar PDF**, **Copiar link público** e **Enviar no WhatsApp** existem só na listagem (`/orcamentos`). Quando você abre um orçamento para editar (`/orcamentos-v3/:id/editar`), não tem como disparar essas ações sem voltar pra lista. Vamos trazê-los para o header do editor.

## O que muda

No header de `NewQuoteFormV3.tsx`, ao lado do botão **Salvar alterações**, adicionar três botões-ícone que aparecem **somente em modo edição** (quando o orçamento já tem número):

1. **Copiar link público** (ícone `Link2`) — copia `/p/{quote_number}` para a área de transferência, igual ao `handleCopyPublicLink` da listagem.
2. **Gerar PDF** (ícone `FileDown`) — reaproveita o `handleGeneratePDF` da listagem (mesma função usada lá).
3. **WhatsApp pro cliente** (ícone `MessageCircle`, verde) — só aparece se o cliente tiver telefone cadastrado; abre `wa.me` com `buildTeamFollowUpMessage` (mesma mensagem de follow-up da listagem).

## Detalhes técnicos

- **Detecção de modo "já salvo"**: usar `isEditing && editMeta` (já existe). Em criação nova, os botões ficam ocultos — você precisa salvar primeiro.
- **Telefone do cliente**: hoje o editor carrega só `cliente.id` e `cliente.nome`. Adicionar fetch leve do `telefone` em `clients` quando `state.cliente.id` mudar (ou estender o loader de edição). Guardar em `clientPhone` local.
- **Reuso de lógica**: extrair as funções `handleCopyPublicLink`, `handleGeneratePDF` e `handleWhatsAppClient` de `OrcamentosV3.tsx` para um helper `src/lib/quotes/quick-actions.ts` para não duplicar código. A listagem passa a importar do helper também.
- **Layout**: agrupar os três ícones com `variant="ghost" size="icon"` num `<div className="flex items-center gap-1">` antes do botão Salvar. No mobile, manter os mesmos ícones (cabem bem).
- **Tooltip/title**: mesmos textos da listagem ("Copiar link público", "Gerar PDF", "Contatar cliente no WhatsApp").

## Fora do escopo

- Não mexer no formulário de criação (novo orçamento sem ID).
- Não alterar a listagem além da refatoração de extrair helpers.
- Não trocar mensagem de WhatsApp nem template do PDF.

## Arquivos afetados

- `src/lib/quotes/quick-actions.ts` (novo)
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (header + fetch de telefone)
- `src/pages/orcamentos-v3/OrcamentosV3.tsx` (usar o helper compartilhado)
