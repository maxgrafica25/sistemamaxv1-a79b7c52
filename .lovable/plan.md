## Problema

No viewer público (`/p/:quoteNumber`), quando o orçamento tem múltiplos itens, o cliente precisa marcar manualmente cada checkbox antes de o botão "Aprovar" habilitar. Isso gera duas dores:

1. Atrito desnecessário quando o cliente quer aprovar tudo.
2. Clientes com baixa familiaridade não entendem que precisam clicar nos itens primeiro.

Mas se o botão for liberado "puro" (sem checkboxes), perdemos o registro de **quais itens** foram efetivamente aprovados — necessário para faturamento e para a aprovação parcial.

## Solução proposta

Inverter o padrão: **todos os itens vêm pré-marcados** ao abrir o orçamento, e adicionar um CTA primário "Aprovar TUDO" claro, mantendo a opção de desmarcar para aprovação parcial.

Assim resolvemos os dois problemas:
- **Q1 (rastreio):** sempre sabemos quais itens foram aprovados — o estado dos checkboxes é a fonte da verdade. Se o cliente clicar em "Aprovar" sem mexer, todos vão como aprovados; se desmarcar alguns, só os marcados vão.
- **Q2 (cognição):** o cliente leigo não precisa entender o conceito de "selecionar". Ele chega, vê o valor total já calculado e um botão verde grande "Aprovar orçamento (R$ XXX)". Funciona no modo "ler e aceitar".

### Mudanças no `ClientViewer.tsx`

1. **Pré-seleção de todos os itens pendentes**
   No `useEffect` que dispara após carregar `materials`, popular `selectedItemIds` com todos os IDs de `pendingItems`. Só executa uma vez, na carga inicial — não sobrescreve mudanças manuais do usuário depois.
2. **Texto auxiliar ajustado** (linha ~590-595)
   Trocar o aviso atual ("Marque os itens que deseja aprovar agora") por algo como:
   *"Todos os itens estão selecionados para aprovação. Desmarque algum se quiser aprovar parcialmente, ou use Alterar para pedir ajustes."*
3. **Indicador visual de "tudo selecionado"** no card de pendentes
   Quando `selectedItemIds.size === pendingItems.length`, mostrar um pequeno badge verde no topo do card: "✓ Todos selecionados". Ajuda a reforçar o estado padrão.
4. **Botão "Selecionar todos / Limpar seleção"** discreto no header do bloco "Aguardando sua decisão" (só aparece se houver 2+ itens). Útil pra quem desmarcou vários e quer voltar.

### Mudanças no `StickyApprovalBar.tsx`

5. **Rótulos do CTA mais claros** (linhas 60-65 e 103-110):
   - Quando todos selecionados → botão diz **"Aprovar orçamento (R$ XXX)"** (sem "selecionados", parece que está aprovando tudo).
   - Quando parcialmente selecionado → **"Aprovar X itens selecionados (R$ XXX)"**.
   - Quando zero selecionado → mantém estado desabilitado com texto **"Selecione ao menos 1 item"**.
6. **Rótulo do total** (linha 60-65) acompanha:
   - Todos: "Total do orçamento"
   - Parcial: "Selecionados (X de Y itens)"
   - Zero: "Selecione os itens para aprovar"

### Mensagem de WhatsApp

7. Ajustar `buildPartialApprovalMessage` em `src/lib/quotes-v2/whatsapp.ts` para detectar quando **todos** os itens pendentes foram aprovados e usar uma mensagem de "aprovação total" ao invés de "aprovação parcial". Algo como:
   - Total: *"Olá! Aprovo o orçamento Nº XXXX na íntegra. Podem prosseguir."*
   - Parcial: mantém a mensagem atual listando itens.

### Fora de escopo

- Não mexer no fluxo de `showOptionsMode` (legado de opções de quantidade, raramente usado).
- Não mexer no RPC `approve_quote_items` no backend — ele já recebe a lista de IDs e funciona perfeitamente para "todos" ou "alguns".
- Não alterar o comportamento de orçamentos com 1 único item (já não tem checkbox).

## Resultado esperado

- Cliente apressado / leigo: abre → clica no botão verde → manda WhatsApp → pronto. Zero atrito.
- Cliente que quer parcial: desmarca o que não quer agora → botão se ajusta dinamicamente → aprova só o resto.
- Você no admin: continua sabendo exatamente quais itens foram aprovados em cada caso, porque o estado dos checkboxes (mesmo pré-marcados) sempre define o payload enviado.
