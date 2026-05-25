## Problema

No preset **Tags** (e em qualquer outro impresso), o botão **Frente / F/V** que adicionei só aparece quando existe uma variante oposta cadastrada no catálogo de Preço Impressão para o mesmo papel + gramatura + tamanho. Para Couchê 300 (e na maioria dos papéis) há só uma linha cadastrada — então o toggle não renderiza.

## Solução

Tornar o toggle **Frente / F/V sempre disponível** no `PrintForm`, aplicando o multiplicador 2× localmente quando o catálogo não tiver a variante oposta. Mesma lógica que o `BookletForm` já usa.

### Mudanças no `PrintForm.tsx`

1. Novo state `sideOverride: "Frente" | "F/V" | null`.
   - Inicializa com o `defaultPaperHint.side` do preset (ex.: Tags vem com F/V já marcado).
2. Computar `effectiveSide = sideOverride ?? catalog.side`.
3. Recalcular `pricing` com base num "catálogo efetivo" — `{ ...catalog, side: effectiveSide }` — para refletir o preço dobrado quando F/V está ativo e o catálogo é Frente.
4. `buildItem`: gravar `side: effectiveSide`, `face: effectiveSide === "F/V" ? "fv" : "frente"` e `valor_unitario` / `custo_unitario` já com o multiplicador aplicado.
5. Renderizar o toggle (Frente | F/V) **sempre** que houver `catalog`, no card de papel selecionado, sem depender de variante oposta no banco.

### Sem mudanças

- `pricing.ts` (`priceOfPrint`) — já consome `valor_unitario` que vai vir pronto.
- Cart / saveQuoteV3 — leem `side` e `face` que serão setados corretamente.
- Migration / preset Tags — `side_default: 'F/V'` continua válido e agora será respeitado mesmo sem variante F/V no catálogo.

### Arquivo

- `src/components/orcamentos-v3/forms/PrintForm.tsx`