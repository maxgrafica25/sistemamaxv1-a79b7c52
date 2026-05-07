## Restrições de visibilidade e desconto máximo

### 1. Sidebar financeiro visível apenas para admin

Em `NewQuoteFormV2.tsx`, envolver a renderização do `<StickyFinancialSidebar />` (desktop e mobile) em `useIsAdmin()`. Não-admins não veem o card lateral nem a barra inferior do DRE — economiza espaço e protege margens/custos.

```tsx
const isAdmin = useIsAdmin();
...
{isAdmin && <StickyFinancialSidebar {...sidebarProps} />}
```

Ajustar o layout para que, quando o sidebar não renderizar, o conteúdo principal ocupe a largura total (remover `lg:flex` gap reservado, ou usar `isAdmin ? "lg:w-[calc(100%-316px)]" : "w-full"` no wrapper).

### 2. Desconto máximo de 7% sobre o valor total

#### `DiscountPaymentBlock.tsx`
- Adicionar prop `maxDiscount?: number` (valor absoluto em R$, calculado pelo pai como 7% do total).
- Adicionar prop `subtotal?: number` para exibir o limite ao usuário.
- Validação no `onChange` do input:
  - Se `discountType === "percent"` e valor > 7 → clamp para 7 + toast "Desconto máximo permitido: 7%".
  - Se `discountType === "brl"` e valor > `maxDiscount` → clamp para `maxDiscount` + toast "Desconto máximo: R$ X,XX (7% do total)".
- Adicionar texto auxiliar abaixo do input: `Máx. 7% (R$ X,XX)`.

#### `NewQuoteFormV2.tsx`
- Calcular `maxDiscountBRL = subtotalBeforeDiscount * 0.07` e passar para o bloco.
- No `handleSubmit`/save, revalidar como guard de segurança: se desconto excede 7%, abortar com toast.
- Quando o tipo de desconto muda (BRL ↔ %) ou o subtotal muda (item adicionado/removido), reaplicar clamp para que um desconto previamente válido não fique acima do novo limite.

### Observações

- O cap de 7% é fixo (hard-coded). Se no futuro virar configurável por admin, vira campo em `company_settings` — fora de escopo agora.
- A trava é client-side apenas (sem migration). Como a tela de edição já é restrita a usuários autenticados internos, é suficiente para o caso de uso.

### Arquivos editados

- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`
- `src/components/orcamentos-v2/DiscountPaymentBlock.tsx`

Aprova?
