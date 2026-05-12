# Recuperação de orçamentos perdidos (rascunho local)

Resolve o problema de perder o orçamento em andamento por queda de luz, fechamento acidental do navegador ou refresh involuntário. Etapa 1: rascunho local automático no navegador. Etapa 2 (depois): rascunho no banco.

## Como funciona pro usuário

1. Enquanto você preenche um orçamento (novo ou editando), o sistema salva automaticamente uma cópia no próprio navegador a cada poucos segundos.
2. Se o navegador fechar, faltar luz, ou você der refresh sem querer, ao reabrir a tela aparece um aviso no topo: **"Encontramos um rascunho não salvo de [data/hora]. Deseja restaurar?"** com botões **Restaurar** e **Descartar**.
3. Quando você salva o orçamento normalmente (botão Salvar), o rascunho local é apagado automaticamente — não fica lixo acumulado.
4. O rascunho fica preso ao navegador/computador onde foi feito (limitação conhecida desta etapa). A etapa 2 vai resolver isso salvando no banco.

## Escopo (etapa 1 — agora)

Apenas o formulário `NewQuoteFormV2` em `/orcamentos-v2/novo` e `/orcamentos-v2/:id/editar`.

### Comportamento

- **Auto-save**: a cada ~3 segundos de inatividade (debounce), serializa o estado em JSON e grava no `localStorage`.
- **Chave**: `quote-draft:new` para novo; `quote-draft:edit:<quoteId>` para edição.
- **TTL**: rascunhos com mais de 7 dias são ignorados/limpos automaticamente.
- **Banner de recuperação**: aparece no topo do formulário só se houver rascunho válido. Mostra data/hora ("há 2 horas") + botões Restaurar / Descartar.
- **Limpeza**: rascunho é removido após Salvar com sucesso, após Descartar, ou após Restaurar+Salvar.
- **Indicador discreto**: pequeno texto "Rascunho salvo automaticamente" perto do botão Salvar (atualiza com o último auto-save). Se o auto-save falhar (quota cheia), troca para um aviso sutil "Não foi possível salvar rascunho local".

### Fora do escopo desta etapa

- Auto-save no banco (etapa 2).
- Outros formulários (clientes, pedidos, equipamentos etc.).
- Sincronização entre navegadores/dispositivos.

## Detalhes técnicos

### Hook genérico — `src/hooks/useLocalDraft.ts`

- API: `useLocalDraft<T>(key, state, { debounceMs, ttlDays, version, enabled })` → retorna `{ savedAt, error }`.
- Utilitários: `loadDraft(key, expectedVersion)`, `clearDraft(key)`, `hasDraft(key, expectedVersion)`.

**Formato salvo no localStorage:**

```json
{
  "version": 1,
  "savedAt": "2026-05-12T12:00:00.000Z",
  "data": { ... estado do formulário ... }
}
```

**Versionamento (`version: 1`):**
- Toda gravação inclui `version` no envelope.
- `loadDraft` / `hasDraft` comparam `parsed.version === expectedVersion`. Se não bater, o rascunho é tratado como inexistente e removido silenciosamente do localStorage (banner não aparece, nada quebra).
- Quando os campos do formulário mudarem de forma incompatível no futuro, basta incrementar a constante `QUOTE_DRAFT_VERSION` no componente — rascunhos antigos são automaticamente ignorados.

**Tratamento de erro de quota / acesso:**
- Tudo que toca `localStorage` (`getItem`, `setItem`, `removeItem`, `JSON.parse`) fica dentro de `try/catch`.
- Falha em `setItem` (QuotaExceededError, modo privado do Safari, storage desabilitado): o hook não trava, apenas guarda `error: 'quota' | 'unavailable'` no estado retornado e não tenta salvar de novo até o próximo debounce.
- Falha em `getItem` / `JSON.parse`: trata como "sem rascunho" e tenta limpar a chave (também em try/catch).
- O componente usa esse `error` para alternar o microtexto perto do botão Salvar para o aviso sutil.

### Integração em `src/components/orcamentos-v2/NewQuoteFormV2.tsx`

- Constante local `const QUOTE_DRAFT_VERSION = 1;`
- Montar `draftState` apenas com campos editáveis: `client`, `clientId`, `clientPhone`, `product`, `validity`, `profitMargin`, `notes`, `quoteOptions`, `attentionTo`, `hiddenExtras`, `freightValue`, `freightTypeId`, `tags`, `labor`, `materials`, `thirdParty`, `cvItems`, `discountValue`, `discountType`, `paymentMethod`.
- `useLocalDraft(draftKey, draftState, { version: QUOTE_DRAFT_VERSION, debounceMs: 3000, ttlDays: 7, enabled: !loadingInit && !isLocked })`.
- Após `loadingInit` virar false, checar `hasDraft(draftKey, QUOTE_DRAFT_VERSION)`; se houver, mostrar banner (`Alert` shadcn) acima do formulário.
- **Restaurar**: aplica `data` aos respectivos `setState`s e fecha o banner.
- **Descartar**: chama `clearDraft` e fecha o banner.
- Após salvar com sucesso (handler atual de Salvar), chamar `clearDraft(draftKey)`.
- Catálogos pesados (`printingCatalog`, `processSteps`, `markupTiers` etc.) **não** entram no rascunho — são recarregados do banco normalmente.

Não exigirá nenhuma migração de banco.
