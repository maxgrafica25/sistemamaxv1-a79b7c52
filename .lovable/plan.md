## Problema

Quando o cliente clica em "Aprovar X itens via WhatsApp", o sistema abre `https://wa.me/...` que redireciona para `api.whatsapp.com`. No desktop sem o app instalado, isso mostra o diálogo "Abrir WhatsApp?" — confuso para clientes leigos, especialmente os que não usam o app.

A aprovação **já foi gravada no banco** nesse ponto (RPC executado antes do `window.open`), então o ato de "abrir o WhatsApp" é só para enviar a mensagem de confirmação. Mas hoje só existe um caminho e ele falha em desktop sem app.

## Solução

Após a aprovação ser gravada com sucesso, **em vez de abrir o WhatsApp direto**, exibir um diálogo (`Dialog` do shadcn) "Aprovação registrada! Como deseja enviar a confirmação?" com 3 opções claras:

1. **WhatsApp Web** (botão verde, ideal para desktop)
   - Abre `https://web.whatsapp.com/send?phone=...&text=...` em nova aba.
2. **WhatsApp no celular** (botão verde outline)
   - Abre `https://wa.me/<phone>?text=...` (comportamento atual, ideal para mobile).
3. **Copiar mensagem** (botão outline)
   - Copia mensagem + número da gráfica para a área de transferência. Toast: "Mensagem copiada. Cole no seu WhatsApp."

O diálogo também exibirá:
- Pré-visualização da mensagem (read-only `<pre>` com a mensagem que será enviada).
- O número da gráfica formatado (ex: "(11) 98765-4321"), para o caso de o cliente preferir digitar.
- Aviso "Sua aprovação já foi registrada. Esta etapa apenas confirma para a gráfica."

Detecção de mobile (`/Android|iPhone|iPad/i.test(navigator.userAgent)`) será usada apenas para **destacar** o botão recomendado (badge "Recomendado") — sem forçar caminho.

## O que muda

### Arquivo novo: `src/components/orcamentos-v2/client-viewer/WhatsAppShareDialog.tsx`
Componente controlado (`open`, `onOpenChange`) recebendo `message`, `phone`, `phoneDisplay`. Implementa os 3 botões + preview.

Helpers de URL (em `src/lib/quotes-v2/whatsapp.ts`):
- `buildWaWebUrl(message, phone)` → `https://web.whatsapp.com/send?phone=...&text=...`
- (mantém `buildWaUrl` para mobile/app)

### `src/pages/orcamentos-v2/ClientViewer.tsx`
- Remover o `window.open(url, ...)` no fluxo de aprovação parcial/integral (linha ~395).
- Após `loadData()` e `trackEvent`, guardar a mensagem em estado (`pendingShareMessage`) e abrir `WhatsAppShareDialog`.
- Idem no fluxo de "Solicitar alteração de item" (linha ~564) — substituir abertura direta por mesmo diálogo.

### `src/components/orcamentos-v2/client-viewer/StickyApprovalBar.tsx`
- Botão "Solicitar Alteração" (modo `items`) hoje usa `<a href={adjustUrl}>`. Trocar por `onClick` que dispara o mesmo diálogo via callback `onShareMessage(message)` exposto pelo pai.
- Modo `option` (legado) idem para o botão "Aprovar Orçamento".

## Detalhes técnicos

- `web.whatsapp.com/send` funciona em desktop sem confirmação de "abrir app" e não exige login adicional se a sessão já estiver ativa; se não estiver, mostra QR code — o que é OK e familiar.
- Copiar usa `navigator.clipboard.writeText(`${message}\n\nWhatsApp: ${phoneDisplay}`)` com fallback para `document.execCommand('copy')`.
- Tracking: chamar `trackEvent(quoteId, "whatsapp_share")` somente quando o cliente efetivamente clicar em uma das 3 opções (não na abertura do diálogo), incluindo um sub-tipo (`web` | `app` | `copy`) se quisermos métrica futura — por ora apenas mantém o evento atual.

## Fora de escopo

- Não alteramos `EngagementPopover.tsx` nem `LabelLayoutCalculator.tsx` (são usados pela equipe interna, não por clientes finais).
- Não alteramos o fluxo de `mode="option"` legado de WhatsApp share fora do ClientViewer.
