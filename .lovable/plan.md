## Mudança

Remover o popup "Avisar a gráfica sobre os itens aprovados" que aparece para o cliente logo após a aprovação no viewer público, e em troca disponibilizar para a equipe, na lista de orçamentos, um botão de **contato via WhatsApp** que copia/abre uma mensagem pronta para enviar ao cliente quando necessário.

## O que muda

### 1. Viewer público (`/p/<numero>`) — remover o WhatsApp pós-aprovação
Em `src/pages/orcamentos-v2/ClientViewer.tsx`, após o `submitApproval()` registrar o aceite com sucesso, o código hoje:

- Mostra o toast "Aprovação registrada! Avise a gráfica pelo WhatsApp (opcional)."
- Abre automaticamente o `WhatsAppShareDialog` com a mensagem da aprovação.

Será alterado para:
- Toast de sucesso mais limpo: "Aprovação registrada! A gráfica já foi notificada."
- **Não abre mais** o `WhatsAppShareDialog`.
- O fluxo "Solicitar alteração" (`onRequestAdjust`) **permanece igual** — esse caso ainda precisa de WhatsApp porque é uma conversa, não uma confirmação registrada.

O componente `WhatsAppShareDialog` continua existindo (usado no fluxo de alteração).

### 2. Lista de orçamentos — botão "Contatar no WhatsApp"
Em `src/pages/orcamentos-v2/OrcamentosV2.tsx`, na coluna **Ações** de cada linha, adicionar um botão com ícone do WhatsApp (verde) que:

- Aparece somente quando `client_phone` está preenchido.
- Ao clicar, abre `https://wa.me/<numero>?text=<mensagem>` em nova aba.
- A mensagem é contextual ao status do orçamento:
  - **Pendente / Parcial:** "Olá {primeiro nome}! Aqui é da {empresa}. Estou passando para saber se conseguiu analisar a proposta {Nº} que enviamos. Posso ajudar com algo?"
  - **Aprovado:** "Olá {primeiro nome}! Aqui é da {empresa}. Tudo certo com a aprovação do Orçamento {Nº} — qualquer dúvida sobre a produção, é só chamar."
  - **Recusado:** "Olá {primeiro nome}! Aqui é da {empresa}. Vi que o Orçamento {Nº} não seguiu adiante. Posso ajustar algo para fechar com a gente?"

Posicionamento: junto dos ícones de copiar link / favorito / PDF que já existem, antes de "Gerar OP".

Tooltip: "Contatar cliente no WhatsApp".

### 3. Sem mudança no banco
Apenas frontend. Sem migration, sem alteração de RLS, sem alteração nas funções de tracking (o evento `whatsapp_share` continua disparado quando cliente compartilha pelo viewer; aqui é equipe interna, não geramos evento).

## Arquivos afetados

- `src/pages/orcamentos-v2/ClientViewer.tsx` — remover `openShare(...)` do branch de aprovação; ajustar toast.
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — adicionar o botão WhatsApp na coluna Ações com a função de mensagem contextual.
- (Opcional) `src/lib/quotes-v2/whatsapp.ts` — adicionar helper `buildTeamFollowUpMessage(status, ...)` para manter as 3 mensagens centralizadas.

Sem alterações em `WhatsAppShareDialog`, `StickyApprovalBar`, `EngagementPopover` ou `useCompanySettings`.
