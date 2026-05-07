
## Problema

Hoje o cliente clica em "Aprovar X itens via WhatsApp", o sistema marca como **aprovado imediatamente** e só depois abre o diálogo do WhatsApp. Se ele fechar a janela, não enviar a mensagem ou nem abrir o WhatsApp, o item fica aprovado no sistema **sem nenhum comprovante** vindo dele — o que enfraquece a defesa caso o cliente negue depois.

A mensagem do WhatsApp é frágil como prova (depende do cliente apertar "enviar"). A solução é tornar o **registro no próprio sistema** a prova principal, e o WhatsApp vira apenas notificação/cortesia.

## Solução: Termo de Aceite Eletrônico

Antes de marcar qualquer item como aprovado, abrir um modal de **confirmação obrigatória** que funciona como assinatura eletrônica simples (válida juridicamente como manifestação de vontade — MP 2.200-2/2001).

### Fluxo novo

1. Cliente seleciona itens e clica em "Aprovar X itens".
2. **Abre modal "Confirmação de Aprovação"** com:
   - Resumo: número do orçamento, itens selecionados, total.
   - Texto do termo: *"Declaro que li e aprovo a produção dos itens acima conforme as condições apresentadas no orçamento Nº XXXX. Estou ciente de que esta confirmação tem valor de aceite formal e autoriza o início da produção."*
   - Campo obrigatório: **Nome completo**.
   - Checkbox obrigatório: **"Li e concordo com os termos acima"**.
   - Botão "Confirmar Aprovação" (desabilitado até nome preenchido + checkbox marcado).
3. Ao confirmar:
   - Salva o comprovante no banco (ver schema abaixo) com IP, user-agent, timestamp, snapshot dos itens e nome digitado.
   - Marca os itens como aprovados (RPC atual).
   - **Aí sim** abre o diálogo do WhatsApp como notificação opcional ("Avise a gráfica").
4. Mensagem do WhatsApp passa a incluir: *"Aprovação registrada em DD/MM HH:MM por [Nome]. Comprovante: orcamento.com/p/2026-006"*.

### Para a gráfica (lado interno)

- Na página do orçamento aprovado, mostrar bloco **"Comprovante de Aceite"** com nome, data/hora, IP, dispositivo e link para baixar PDF do termo.
- Botão **"Baixar Comprovante (PDF)"** que gera um documento com: cabeçalho da empresa, dados do orçamento, lista de itens aprovados, texto do termo, nome digitado, timestamp, IP e hash do registro.

### Por que isso é suficiente como prova

- **Autoria**: nome digitado + IP + dispositivo + horário ancorados no servidor.
- **Integridade**: snapshot dos itens fica salvo (descrição + valor no momento do aceite).
- **Manifestação clara de vontade**: termo explícito com checkbox.
- **Não-repúdio**: o link do orçamento é único e privado; quem tem acesso é quem o cliente recebeu por WhatsApp/email.
- Combinado, isso é **mais robusto** do que um print de WhatsApp, porque o WhatsApp pode ser editado/deletado e não tem timestamp confiável de servidor.

## Detalhes técnicos

### Nova tabela `quote_approval_receipts`

```
id              uuid PK
quote_id        uuid (FK quotes)
approved_at     timestamptz default now()
approver_name   text not null
approver_ip     text
user_agent      text
items_snapshot  jsonb  -- [{id, description, qty, unit_price, value}]
total_approved  numeric
terms_version   text   -- ex.: "v1-2026-05" para auditoria de mudanças no termo
quote_number    text
quote_version   integer
```

RLS: `INSERT` liberado para `anon` (mesmo padrão do `quote_events` atual de tracking público); `SELECT` apenas `authenticated`.

### Captura de IP

Edge function `record-approval` (chamada pelo cliente) recebe payload, lê `req.headers["x-forwarded-for"]`, insere no banco e retorna o `receipt_id`. O front então chama o RPC `approve_quote_items` existente. (Alternativa simples: gravar sem IP, só com user-agent — mas IP agrega valor probatório.)

### Componentes

- Novo `ApprovalConfirmDialog.tsx` — modal com nome + checkbox + termo.
- `ClientViewer.tsx` — `handlePartialApproval` passa a abrir o dialog primeiro; só após confirmação chama edge function + RPC + abre WhatsApp.
- `whatsapp.ts` — `buildPartialApprovalMessage` ganha campos `approverName` e `approvedAt` para incluir na mensagem.
- Página interna do orçamento (admin) — novo card mostrando o comprovante; botão de PDF (reusa `production-order-pdf.ts` como base).

### Fora do escopo

- Assinatura digital com certificado ICP-Brasil (overkill para este caso).
- Verificação por SMS/email com código (já descartado pela escolha "digitar nome").
- Mudança no fluxo de aprovação por opções (`mode === "option"` legado) — só atualizar o modo `items`.

## Arquivos afetados

- **Novo**: `supabase/migrations/...` (tabela `quote_approval_receipts`)
- **Novo**: `supabase/functions/record-approval/index.ts`
- **Novo**: `src/components/orcamentos-v2/client-viewer/ApprovalConfirmDialog.tsx`
- **Editar**: `src/pages/orcamentos-v2/ClientViewer.tsx` (intercepta aprovação)
- **Editar**: `src/lib/quotes-v2/whatsapp.ts` (mensagem com nome/data)
- **Editar**: tela interna do orçamento (mostrar comprovante) — a definir entre `EditQuoteV2.tsx` ou criar bloco no `OrcamentosV2.tsx`
- **Novo**: `src/lib/quotes-v2/approval-receipt-pdf.ts` (gerador do PDF)
