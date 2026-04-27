# Aprovação parcial de orçamento — Fase 1

Modelo: **status por item + versionamento automático**. Aprovados ficam imutáveis (com data e prova). Pendentes podem ser editados ou aprovados em rodadas sucessivas no mesmo link. Mudar item já aprovado exige criar uma nova versão do orçamento.

## Por que assim

- **Cliente nunca confunde**: aprovados aparecem em bloco separado, com check verde e data — sem checkbox, sem botão "alterar"
- **Gráfica nunca produz errado**: itens aprovados ficam com cadeado no painel admin
- **Sem pressão de "tudo ou nada"**: cliente decide no ritmo dele, em quantas rodadas quiser
- **Histórico blindado**: se algo aprovado mudar, vira nova versão; a anterior fica congelada

## O que muda para o cliente (página pública)

```text
┌─ ORÇAMENTO Nº 123 · v1 ──────────────┐
│                                      │
│ ✅ APROVADOS  ─────  R$ 370,00       │
│ ✓ Cartões 500un · aprovado 26/04     │
│ ✓ Banner 1un    · aprovado 26/04     │
│                                      │
│ ⏸️  AGUARDANDO SUA DECISÃO            │
│ ☐ Blocos 100un      R$ 280   [💬]    │
│ ☐ Adesivos 600un    R$ 720   [💬]    │
│                                      │
│ Selecionados agora: R$ 0,00          │
│ [✅ Aprovar selecionados]            │
│ [💬 Solicitar alteração geral]       │
└──────────────────────────────────────┘
```

- Aprovados em cima, com check e data — visualmente "fechados"
- Pendentes embaixo, com checkbox e botão "Alterar" individual (já existe)
- Total separado: **subtotal aprovado** vs **selecionados agora**
- Mensagem do WhatsApp lista exatamente o que está sendo aprovado, com valores

## O que muda para a gráfica (painel admin)

- Cada item da lista mostra status: ⏸️ Pendente · ✅ Aprovado · ❌ Recusado
- Itens aprovados ficam com cadeado 🔒 (não dá pra editar nem excluir)
- Status do orçamento ganha novo estado: **"Parcial"** (alguns aprovados, outros pendentes)
- Botão **"Criar nova versão"** quando precisar mexer em item aprovado:
  - Congela o orçamento atual (vira histórico, não some da listagem)
  - Cria v2 herdando tudo, pendentes editáveis
  - Listagem agrupa versões: `Nº 123 (v1, v2)`

## Mudanças no banco

**Adicionar em `quote_materials`:**
- `status` — pendente / aprovado / recusado (default: pendente)
- `approved_at` — timestamp da aprovação
- `approved_value` — valor congelado no momento da aprovação (proteção)

**Adicionar em `quotes`:**
- `version` — número da versão (default: 1)
- `parent_quote_id` — referência à versão anterior (null na v1)
- `is_locked` — true quando virou histórico de uma nova versão
- Status `partial` adicionado às opções existentes

**RLS:** mantém a lógica atual (admins editam, página pública lê). Anônimos podem **atualizar status do item** apenas via função `SECURITY DEFINER` que valida: o item pertence ao orçamento daquele link, está pendente, e nunca rebaixa um aprovado.

## Mudanças no código

- **`ClientViewer.tsx`**: separar lista em "aprovados" e "pendentes", checkbox por pendente, recálculo ao vivo, novo botão "Aprovar selecionados via WhatsApp"
- **`StickyApprovalBar.tsx`**: passar a aceitar `selectedItems[]` em vez de só opção; mensagem do WhatsApp lista os itens aprovados com valores
- **`whatsapp.ts`**: nova função `buildPartialApprovalMessage` que monta texto tipo *"Aprovo: 100 Blocos (R$ 280) e 600 Adesivos (R$ 720). Total: R$ 1.000,00"*
- **`EditQuoteV2.tsx`** (admin): mostrar status por item, bloquear edição/exclusão de aprovados, botão "Criar nova versão"
- **`OrcamentosV2.tsx`** (listagem): badge "Parcial", agrupar versões do mesmo orçamento
- **Função RPC `approve_quote_items(quote_id, item_ids[])`**: valida e marca itens como aprovados de forma atômica (registra timestamp e congela valor)
- **Função RPC `create_quote_version(quote_id)`**: clona orçamento, herda status dos itens, marca o original como `is_locked`

## Compatibilidade com orçamentos existentes

- Migração não toca em orçamentos antigos: eles continuam com `version=1`, status global como hoje
- Itens existentes ganham `status='aprovado'` se o orçamento estiver `approved`, `'pendente'` caso contrário
- Tudo continua funcionando como antes para quem ainda não usou o fluxo novo

## Fora do escopo desta fase

- **PDF / envio por e-mail**: vamos fazer em fase separada depois que você validar a aprovação parcial com clientes reais. Assim testa uma mudança por vez.
- **Notificações automáticas** quando cliente aprova um item (pode entrar depois)
- **Bloqueio de produção** baseado em status (entra junto com o módulo de OP)

---

Aprova esse plano? Se sim, eu sigo com a migração do banco primeiro (que pede sua confirmação), depois o código.
