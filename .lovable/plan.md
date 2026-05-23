## Checklist em popup antes de salvar

Hoje o checklist (perguntas dinâmicas) divide espaço no sidebar de itens do orçamento. Vai virar uma etapa explícita **antes do envio**, com toggle para habilitar/desabilitar.

### 1. Banco — `global_settings`

Migration adicionando coluna:

- `checklist_before_save boolean NOT NULL DEFAULT true`

### 2. Configurações do sistema

Em `src/pages/Configuracoes.tsx` (aba de configurações gerais — mesmo formulário que já edita `waste_pct`, `default_margin_pct` etc):

- Novo `Switch` "Confirmar checklist antes de salvar orçamento"
- Descrição: "Quando ativo, ao clicar em Salvar abre um popup com todas as perguntas pendentes para revisão"
- Persiste em `global_settings.checklist_before_save`

Atualizar `useGlobalSettings`:
- Adicionar `checklist_before_save: boolean` ao `GlobalSettingsData` e `DEFAULTS` (true).

### 3. Editor de orçamento — `NewQuoteFormV3.tsx`

Quando `checklist_before_save = true`:

- **Remover** `<QuoteChecklistPanelV3>` do sidebar de itens (o painel some).
- Interceptar o handler de salvar: ao clicar em "Salvar orçamento", se houver itens CV (que é a condição atual do checklist), abre um `Dialog` com o `QuoteChecklist` dentro (`embedded`), título "Revisão do checklist".
- O Dialog tem dois botões:
  - **Salvar mesmo assim** — fecha e prossegue com o save (mesmo com perguntas pendentes).
  - **Confirmar e salvar** — só habilitado quando `pending = 0`; fecha e prossegue.
- Respostas e auto-labor continuam fluindo pelos mesmos callbacks já existentes (`onAnswersChange`, `onAutoLaborChange`).

Quando `checklist_before_save = false`:

- Comportamento atual: checklist no sidebar, sem popup.

### 4. Escopo do que NÃO muda

- `QuoteChecklist` (componente real das perguntas) e `QuoteChecklistPanelV3` continuam existindo — o popup reusa exatamente o mesmo conteúdo.
- Tabelas `quote_checklist_*` ficam intactas.
- Mobile (`MobileCart`) continua sem checklist (já é assim).
