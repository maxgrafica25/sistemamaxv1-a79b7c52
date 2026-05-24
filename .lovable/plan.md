# Aumentar largura da coluna de itens do orçamento

Hoje o grid em `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (linha 413) usa:

```
lg:grid-cols-[1fr_360px]
```

A coluna direita (carrinho + resumo financeiro) tem **360px** fixos.

## Mudança

Aumentar para **420px** em `lg`, e adicionar um breakpoint maior para telas mais largas:

```
lg:grid-cols-[1fr_420px] xl:grid-cols-[1fr_460px]
```

Ganho de ~60–100px de respiro no carrinho (títulos longos, "+ N faixas sugeridas", subtítulos como `5 folhas | Couche 300g | Frente`) sem comprometer o formulário à esquerda, que continua fluido.

## Arquivo

- `src/components/orcamentos-v3/NewQuoteFormV3.tsx` (apenas a linha do grid principal)
