# Ajustes no card "Apostila + Kit" do carrinho

Mexer apenas em `src/components/orcamentos-v3/cart/UnifiedCart.tsx` (componente `BundleCard`). Sem alteração em lógica de preço ou persistência.

## 1. Destacar a quantidade

Hoje a quantidade aparece embutida no título ("Apostila 1× — miolo …"), o que fica fraco. Vou:

- Remover o `"Apostila Nx — "` do início do `bundle_label` (ajuste em `buildBookletBundleLabel.ts`: gerar só `"miolo 20fl Sulfite 75g F/V · capa padrão · …"`).
- No `BundleCard`, mostrar a quantidade do líder (apostila) como um chip grande à esquerda, no mesmo padrão das linhas de faixa (ex.: **`10 un`** em `tabular-nums font-medium`), seguido do título descritivo.

Resultado visual:

```text
[📖]  10 un   miolo 20fl Sulfite 75g F/V · capa padrão · espiral 12mm · furação …
                                                                       R$ 167,90
       › ver detalhes
```

## 2. Remover o badge roxo "Apostila + Kit (N itens)"

No `BundleCard`, apagar o `<Badge>` com `Layers` + `"{LABEL} + Kit (N itens)"`. A informação de composição já fica clara pelo título e pelo "ver detalhes". O toggle "ver detalhes / ocultar detalhes" continua exatamente como está.

## 3. Sobre juntar 5 un e 10 un de Faixas no mesmo bloco

No print, o segundo card ("Apostila 5× 20fl Sulfite 75g" com badge **Faixas (2)** listando 5 un e 10 un) **já está correto e é exatamente o comportamento atual** para faixas de preço — elas compartilham `tier_group_id` e renderizam como um grupo único com uma linha por quantidade. Não precisa mexer.

O que **não** existe hoje é gerar Faixas a partir de um bundle "Apostila + Kit" inteiro (o simulador de faixas só clona o miolo). Se você quiser que no futuro o botão "Comparar faixas" também duplique o kit junto, isso é outra feature — me avise e eu planejo separado.

## Fora de escopo

- Lógica de preço, persistência, PDF.
- Fluxo de Faixas + Kit combinados (mencionado só para responder à dúvida).
