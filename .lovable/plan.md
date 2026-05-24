# Documentar regime de cálculo do Preço de Impressão

## Contexto
O toggle global **"Regime de cálculo de preço"** (Configurações → Geral) afeta apenas **Orçamentos V3, CV e Etiquetas**. O módulo **Preço de Impressão** sempre opera **por dentro**, via faixas de markup (`markup_tiers`) com a fórmula:

```
preço = custo / (1 − (fixed% + variable% + margin%) / 100)
```

Isso é um detalhe que hoje não está explícito em lugar nenhum, e pode confundir quem ativar "por fora" esperando que valha para tudo.

## Mudanças (somente UI / texto)

### 1. Configurações → cartão do toggle de regime
Adicionar nota informativa abaixo das duas opções (Por fora / Por dentro):

> **Importante:** o módulo **Preço de Impressão** sempre calcula **por dentro** (via faixas de markup configuradas em cada categoria de impressora). Este toggle afeta apenas **Orçamentos V3**, **Comunicação Visual** e **Etiquetas**.

Visual: bloco discreto com ícone `Info` e fundo `muted`, dentro do mesmo card do toggle.

### 2. Página Preço de Impressão (`PrecoImpressao.tsx`)
Adicionar um pequeno badge/tooltip no cabeçalho da página explicando que o preço de venda exibido já é calculado por dentro, mostrando a fórmula ao passar o mouse:

> "Preço calculado por dentro: custo ÷ (1 − (custo fixo% + custo variável% + margem%) / 100). Não afetado pelo toggle de regime global."

### 3. `PrintingItemSearch` (dropdown de busca)
Já mostra `custo` e `preço/folha`. Adicionar tooltip no preço explicando brevemente que vem da faixa de markup ativa (por dentro).

## Fora de escopo
- Mudar a lógica de cálculo do Preço de Impressão.
- Tornar o módulo Preço de Impressão configurável pelo toggle global.
- Mexer em Kits (já documentado em memória como por dentro).

## Arquivos afetados
- `src/pages/Configuracoes.tsx` — nota informativa no cartão do regime.
- `src/pages/PrecoImpressao.tsx` — badge/tooltip no cabeçalho.
- `src/components/orcamentos-v3/shared/PrintingItemSearch.tsx` — tooltip no preço/folha.
