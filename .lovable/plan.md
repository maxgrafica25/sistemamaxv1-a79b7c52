
The screenshot mostra exatamente o estado esperado: ANS (1 faixa) e FuturaIM (7 faixas) detectados, Atual Card e Imprima Rápido marcados como "Erro" com a mensagem "Este site exige captura visual (mais lenta). Use 'Re-detectar individualmente' ou insira as faixas manualmente."

Isso confirma que o fluxo está funcionando como projetado — em "Em massa" o fallback visual está propositalmente desativado para esses dois domínios. Mas o usuário está pedindo que **funcione**, ou seja, que essas linhas de erro virem linhas detectadas ou tenham um caminho prático imediato dentro do mesmo modal.

Hoje, ao falhar, o item só mostra texto. Não há botão visível para:
1. Tentar de novo individualmente (com visual ligado)
2. Abrir o formulário manual de faixas

Plano:

1. Em `NovoSiteDialog.tsx`, em cada item do "Em massa" com status `error` ou `tiers.length === 0`, adicionar dois botões inline:
   - **"Tentar com captura visual"** → chama `detect-price-tiers` de novo só para essa URL com `allowVisual: true`. Atualiza o item no lugar.
   - **"Inserir manualmente"** → abre o formulário manual já existente (`manualMode`) pré-preenchido com a URL daquele item, e ao salvar marca o item como sucesso.

2. Garantir que o botão "Detectar todos" reabilite os itens em erro (re-tentar só os que falharam, sem refazer os que já vieram com faixas).

3. Para a tentativa visual individual disparada do modal, usar timeout maior no client (até 150s) e mostrar spinner no item específico, sem travar os outros.

4. Não mexer na edge function — o comportamento atual (visual sob demanda) é o correto. Só estamos expondo na UI o caminho que já existe no backend.

5. Pequeno ajuste de copy: trocar "Erro" + frase longa por badge "Requer ação" + dois botões claros, para o usuário entender que não é um erro definitivo.

Arquivos:
- `src/components/monitoramento/NovoSiteDialog.tsx`

Sem mudanças no banco e sem mudança em edge function.

Resultado: no mesmo modal "Em massa", o usuário vê os 2 itens problemáticos com botões "Tentar visual" e "Inserir manualmente", resolve sem fechar o diálogo, e termina o lote completo.
