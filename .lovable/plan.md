## Objetivo

Quando o usuário selecionar um papel "Lona" no PrintForm V3, oferecer um toggle "É banner?" que altera dinamicamente a lista de acabamentos exibida e, ao informar a largura do banner, sugerir automaticamente o melhor bastão (105 / 150 / 200 cm).

## Mudanças

### 1. Detecção de Lona em `PrintForm.tsx`
- Após `setCatalog`, computar `isLona = /lona|banner|vinil/i.test(catalog.paper_type)`.
- Quando `isLona` for true, mostrar ao lado do badge do catálogo um `Switch` "É banner?" (`isBanner`, default `true` se o nome já contiver "banner").

### 2. Lista de acabamentos dinâmica
- Criar dois conjuntos:
  - `FINISHES_LONA`: laminação, ilhós, bastão, corte especial, costura/bainha.
  - `FINISHES_BANNER`: ilhós, bastão (com sugestão), bainha, reforço de borda, ponteiras.
  - `FINISHES_PADRAO` (atual): para os demais papéis.
- Selecionar o array conforme `isLona && isBanner`, `isLona && !isBanner`, ou padrão.
- Ao trocar entre listas, limpar chips que não existem no novo conjunto.

### 3. Campo de medidas do banner
- Quando `isLona && isBanner`, exibir dois inputs compactos: **Largura (cm)** e **Altura (cm)** logo abaixo do toggle.
- A largura alimenta o seletor de bastão; altura fica registrada na descrição.

### 4. Lógica de sugestão de bastão
Criar `src/components/orcamentos-v3/shared/bastaoSuggester.ts`:

```ts
export const BASTOES_CM = [105, 150, 200];
export const SOBRA_CM = 1; // por lado

export function sugerirBastao(larguraCm: number) {
  const necessario = larguraCm + 2 * SOBRA_CM;
  const candidatos = BASTOES_CM.filter(b => b >= necessario);
  if (candidatos.length === 0) {
    // banner maior que 198cm útil → usar 2× o maior, ou exigir emenda
    const qtd = Math.ceil(necessario / (BASTOES_CM.at(-1)! - 2 * SOBRA_CM));
    return { bastao: BASTOES_CM.at(-1)!, quantidade: qtd, emenda: true };
  }
  return { bastao: Math.min(...candidatos), quantidade: 1, emenda: false };
}
```

Regra: banner de 105cm **não** pode usar bastão 105 — sugere 150 (porque precisa de 107cm).

### 5. UI da sugestão dentro do chip "Bastão"
Quando o chip "Bastão" estiver ativo e houver largura informada:
- Mostrar mensagem destacada: *"Sugerido: bastão de **150 cm** × 1 un (banner 120cm + 2cm de sobra)"*.
- Permitir override manual via Select (105 / 150 / 200) e input de quantidade.
- Quando exigir emenda (largura > 198cm útil), avisar em amarelo: *"Necessária emenda — 2 bastões de 200cm"*.

### 6. Persistência
- Salvar no `V3PrintItem.finishings` os ids habilitados (mesmo schema atual).
- Para registrar a escolha do bastão, anexar metadado simples na `descricao` final (ex: `… — Bastão 150cm × 1`). Sem mudança de schema/DB.

## Arquivos afetados

- `src/components/orcamentos-v3/forms/PrintForm.tsx` — toggle banner, inputs largura/altura, troca dinâmica de FINISHES, render da sugestão de bastão.
- `src/components/orcamentos-v3/shared/bastaoSuggester.ts` (novo) — função pura + constantes.
- (Opcional) `src/components/orcamentos-v3/shared/FinishingProgressive.tsx` — já suporta `advanced` ReactNode; usaremos para embutir o seletor de bastão.

## Fora de escopo
- Cálculo de **preço** dos bastões (sem catálogo de bastões cadastrado ainda — apenas sugestão visual).
- Persistência estruturada do bastão escolhido em coluna própria.
- Alterações em V2.

Confirma se posso seguir com essa abordagem (sugestão visual sem precificar o bastão) ou se você quer também cadastrar preço por bastão para entrar no total?