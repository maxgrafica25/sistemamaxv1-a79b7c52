## Problema

No preset **Tags**, ao abrir o formulário o papel "Couche 300 — A4 F/V" é selecionado automaticamente (Print 1). Ao clicar em **Frente**, a seleção é desfeita e o usuário volta para a tela de busca de papel (Print 2). O esperado é apenas alternar o lado mantendo o mesmo papel.

## Causa

`src/components/orcamentos-v3/forms/PrintForm.tsx` (linhas 223‑228) tem um `useEffect` que zera `catalog` sempre que o usuário escolhe "Frente" e o item selecionado é uma linha de catálogo cadastrada como `F/V`:

```ts
if (catalog && sideChoice === "Frente" && catalog.side === "F/V") {
  setCatalog(null);
}
```

Isso conflita com `effectiveCatalog` (linhas 212‑216), que já aplica o `sideChoice` por cima do item escolhido (ajustando custo via `pricePerSheet`). O reset força o usuário a re-selecionar o papel.

## Correção

Substituir o efeito por uma lógica que, ao trocar de lado, **tenta encontrar uma variante equivalente no catálogo com o lado desejado** (mesmo `paper_type` + `grammage` + `size`):

- Se existir variante com o novo lado → `setCatalog(variante)`.
- Se não existir → manter `catalog` atual; `effectiveCatalog` já aplica o override de lado e o cálculo de preço (F/V dobra custo, Frente reduz à base).

Comportamento simétrico em ambos os sentidos (Frente → F/V e F/V → Frente). Nenhuma alteração na lógica de preço ou no catálogo.

### Edit pontual

`src/components/orcamentos-v3/forms/PrintForm.tsx` ~linhas 223‑228:

```ts
useEffect(() => {
  if (!catalog) return;
  if (catalog.side === sideChoice) return;
  const sibling = items.find(
    (it) =>
      it.paper_type === catalog.paper_type &&
      (it.grammage || "") === (catalog.grammage || "") &&
      it.size === catalog.size &&
      it.side === sideChoice,
  );
  if (sibling) setCatalog(sibling);
  // senão: mantém catalog; effectiveCatalog cuida do override.
}, [sideChoice, catalog, items]);
```

## Fora do escopo

- Lógica de preço, multiplicadores F/V, tiers.
- Outros presets (BusinessCard, Certificate, Booklet).
- Layout/posicionamento do header (já corrigido).

## Verificação

1. Abrir orçamento → escolher preset **Tags** → confirmar que abre com "Couche 300 — A4 F/V" selecionado.
2. Clicar **Frente** → seleção deve permanecer (mesmo papel, lado Frente, preço recalculado).
3. Clicar **F/V** → volta para F/V sem perder o item.
4. Testar também no preset **Cartão de Visita** / **Certificados** (que também usam hint F/V) para confirmar simetria.
