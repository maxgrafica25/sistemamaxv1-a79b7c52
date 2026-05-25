# Remover Assistente IA de orçamentos + bloco "Tem arte pronta?"

Duas limpezas na tela de orçamento V3. Nenhuma mexe na Júlia (assistente virtual geral) nem no Checklist em si.

## 1) Eliminar o Assistente de IA de orçamentos

Esse é o painel com "🔧 sugestões", "📊 padrão histórico" e "🤖 IA contextual (Gemini)" que aparecia no carrinho do orçamento V3. Já tinha sido escondido do carrinho, mas o código, a aba de regras e as Edge Functions continuam no sistema. Vamos remover tudo.

**Frontend (deletar arquivos):**
- `src/components/orcamentos-v3/cart/QuoteAssistantPanelV3.tsx`
- `src/components/orcamentos-v3/listing/QuoteAssistant.tsx`
- `src/components/cv-calc/SuggestionsTab.tsx` (aba "Sugestões" em Cadastros CV → regras do assistente)

**Cadastros CV:**
- `src/pages/CadastrosCV.tsx`: remover a aba "Sugestões" (import + entrada em `TABS` + render).

**Backend:**
- Apagar Edge Functions `quote-ai-assistant` e `historical-suggestions`.
- Remover essas duas funções da lista `FUNCTION_NAMES` em `supabase/functions/generate-vps-package/index.ts`.
- Migration para `DROP TABLE` das tabelas de regras/histórico do assistente (`quote_suggestion_rules` e correlatas, se houver). Vou inspecionar o schema antes de escrever o SQL para listar exatamente quais tabelas cair.

**Fora de escopo (mantém):**
- Júlia / `assistente-virtual` (assistente geral do sistema) — intocada.
- Checklist do orçamento — intocado.

## 2) Remover bloco "Tem arte pronta?" do orçamento

Hoje aparece um bloco fixo no topo da coluna de itens (`ArtePromptBlock`) perguntando se o cliente envia arte pronta ou se precisa criar (com tiers Ajuste/Fácil/Moderada/Elaborada/Terceirizada). Vai sair — a pergunta vive só no Checklist (Cadastros CV → Checklist).

**Mudanças:**
- `src/components/orcamentos-v3/NewQuoteFormV3.tsx`: remover o `<ArtePromptBlock …/>` (linhas 416–425) e o import (linha 38).
- `src/components/orcamentos-v3/shared/ArtePromptBlock.tsx`: deletar o arquivo.

**O que acontece com o custo de arte?**
- O campo `art_status` no estado do orçamento continua existindo, mas fica sempre `null` (nenhuma UI seta). Resultado: o custo extra de arte deixa de ser somado automaticamente pelo formulário.
- Para cobrar arte, o usuário usa a pergunta correspondente no **Checklist** (Cadastros CV → Checklist, tipo "Sim/Não + mão de obra"), que já injeta o item de mão de obra no orçamento quando respondida "Sim".

**Fora de escopo:**
- Não vou apagar a coluna `art_status` do banco nem mexer em pedidos/orçamentos antigos que já têm valor salvo — só paro de oferecer a UI nova.

## Passos técnicos resumidos

1. Inspecionar tabelas do assistente IA (`quote_suggestion_rules`, etc.) para montar a migration de DROP.
2. Apagar componentes frontend listados + ajustar `CadastrosCV.tsx` e `NewQuoteFormV3.tsx`.
3. Apagar Edge Functions `quote-ai-assistant` e `historical-suggestions` + atualizar `generate-vps-package`.
4. Rodar migration de DROP das tabelas do assistente.
5. Conferir build/preview: orçamento V3 abre sem o bloco de arte e sem painel do assistente; Cadastros CV não mostra mais a aba Sugestões.
