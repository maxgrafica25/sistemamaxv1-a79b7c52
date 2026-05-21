# Faixas inline antes do "Adicionar"

Mover a comparação de faixas pra fora do popover e transformá-la numa seção fixa, logo acima do botão "Adicionar apostila". O fluxo passa a ser: configuro o produto → opcionalmente listo outras quantidades pra comparar → clico **Adicionar** e o orçamento já recebe a quantidade solicitada + as faixas extras agrupadas no mesmo bloco.

## Mudanças no `BookletForm.tsx`

### 1. Remover o `TierSimulator` (popover) de cima
Tirar o botão "Comparar faixas" que hoje fica colado no input "Qtde de apostilas".

### 2. Nova seção "Faixas adicionais (opcional)"
Bloco discreto entre o resumo (folhas físicas / espiral sugerida) e o painel de Kit Encadernação. Layout:

```text
┌─ FAIXAS ADICIONAIS (opcional) ─────────────────── [▾ ocultar] ─┐
│  Compare preços para outras quantidades. Tudo é adicionado     │
│  no mesmo bloco do orçamento.                                  │
│                                                                │
│  [ Solicitada ] 1 un      preço/un: R$ 167,90   R$ 167,90      │
│                                                                │
│  Sugestões                                                     │
│  ▸ chip 100  ✕   chip 250 ✕   chip 500 ✕   chip 1000 ✕         │
│  [ adicionar qtd ____ ] [ +Add ]   presets: ×2 ×5 +50% Reset   │
│                                                                │
│  Prévia:                                                       │
│   10 un   R$ 16,79/un   R$ 167,90                              │
│   100 un  R$ 9,80/un    R$ 980,00                              │
│   …                                                            │
└────────────────────────────────────────────────────────────────┘
```

- **Faixa "Solicitada"**: sempre a quantidade atual do form (não é chip removível — segue a qtde principal).
- **Sugestões**: chips com remover. Persistem em `localStorage` (mesma chave do `TierSimulator` atual).
- **Prévia inline**: tabela leve (qtd, unit, total) usando o mesmo `compute(q)` que o `TierSimulator` já usa.
- **Toggle ocultar/exibir**: por padrão começa colapsado (só mostra o cabeçalho + chevron) pra não poluir.

### 3. Botão "Adicionar" no rodapé
- Quando não há sugestões: continua **"Adicionar apostila"**, comportamento atual.
- Quando há ≥1 sugestão: vira **"Adicionar apostila + N faixas"** e dispara o mesmo caminho do `submitAsTiers` (qty principal + sugestões → mesmo `tier_group_id`, `tier_primary = true` na principal).
- Quando há sugestões mas o miolo também tem Kit aplicado: prevalece o fluxo de Kit (faixas + kit combinados ficam fora de escopo — vou bloquear o "Adicionar apostila + faixas" se já houver kit selecionado e mostrar um aviso curto).

### 4. Pequeno utilitário reutilizável
Criar `src/components/orcamentos-v3/shared/TierFaixasPanel.tsx` recebendo as mesmas props do `TierSimulator` (`currentQty`, `compute`, `onCloneAsTiers`, `onPickQty`). Reaproveita o mesmo storage. Substitui o popover no Booklet primeiro e fica pronto pra plugarmos em Print/CV/Third/Supply/Label depois.

## Fora de escopo agora

- Aplicar a mesma seção em PrintForm/CVForm/ThirdPartyForm/SupplyForm/LabelEmbeddedForm — vou fazer só no Booklet pra validar o padrão e replico nos outros num próximo passo, se você gostar.
- Combinar Faixas + Kit Apostila num único disparo.
- Persistência de `tier_primary` no banco (continua só na sessão / cart, como hoje).

## O que NÃO muda

- Cálculo de preço, regras de F/V, multiplicadores.
- Card de "Faixas" no carrinho (já mostra Solicitada + Sugestões).
- O `TierSimulator` continua existindo para os outros forms enquanto não migrarmos todos.
