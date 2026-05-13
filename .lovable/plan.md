# Kit Automático de Encadernação para Apostilas

Adicionar um botão "🪄 Sugerir Kit Encadernação" que aparece em itens do tipo Apostila (`bookletUnits > 0`) e insere de uma só vez Capa, Contracapa, Mola (escolhida pelo nº de folhas) e Mão de Obra (Furação + Encadernação) — respeitando faixas de preço dos suprimentos e multiplicação por unidade da mão de obra.

## 1. Novo helper `src/lib/quotes-v2/spiral-selector.ts`

Função pura, sem I/O:

```ts
export function getIdealSpiral(sheets: number): string {
  if (sheets <= 25) return "7mm";
  if (sheets <= 50) return "9mm";
  if (sheets <= 70) return "12mm";
  if (sheets <= 85) return "14mm";
  if (sheets <= 100) return "17mm";
  if (sheets <= 120) return "20mm";
  if (sheets <= 140) return "23mm";
  if (sheets <= 160) return "25mm";
  if (sheets <= 200) return "29mm";
  if (sheets <= 250) return "33mm";
  if (sheets <= 350) return "40mm";
  return "45mm";
}
```

Também exporta padrões de busca por nome:
- Capa frontal: `/capa\s*pp.*line|incolor/i`
- Contracapa: `/capa\s*pp.*camur[cç]a|preta/i`
- Mola: monta regex a partir do diâmetro retornado, ex.: `/espiral.*\b0?9\s*mm\b/i` (normaliza `09mm`/`9mm`/`9 mm`).
- Steps de mão de obra: `/encaderna|fura[cç][aã]o/i`.

## 2. Novo componente `src/components/orcamentos-v2/SuggestBindingKitButton.tsx`

Botão compacto com ícone Sparkles. Recebe via props:
- `parentItemId`, `bookletUnits`, `bookletPages`
- `supplies` (já carregados em `NewQuoteFormV2`), `supplyTiers`
- `processSteps`
- `existingChildMaterials`, `existingChildLabor`
- callbacks: `onAddMaterial(SubformMaterial)`, `onAddLabor(SubformLabor)`
- `globalSettings` / `profitMarginPct` (somente para `margemPct` default ao criar avulso)

Lógica do clique:

1. Lê `units = bookletUnits`, `sheets = bookletPages`.
2. Para cada um dos 3 suprimentos (Capa, Contracapa, Mola):
   - Procura em `supplies` pelo regex correspondente. Para a mola, usa `getIdealSpiral(sheets)` e o regex de diâmetro.
   - Se já existe um filho desse `productKind` no item (Capa/Contracapa/Mola) → pula (idempotente).
   - Se encontrou suprimento: cria `SubformMaterial` com `supplyId`, `description = produto`, `quantity = units`, `unitPrice = valor_unitario`, `margemPct = supply.margem_pct ?? null`, `productKind = "Capa" | "Contracapa" | "Mola"`, `parentItemId`. As faixas (`supply_pricing_tiers`) já são aplicadas pelo motor de pricing existente — apenas garantir o `supplyId` correto.
   - Se NÃO encontrou: cria item avulso com `description` sugerido (ex.: `"Mola Espiral 12mm — preencher"`), `quantity = units`, `unitPrice = 0`, `productKind` setado igualmente para casar com a regra de sincronização `isPerBookletChild`.
3. Mão de obra: procura em `processSteps` por `Furação` e `Encadernação` separadamente. Para cada match:
   - Se já existe labor com mesma descrição → pula.
   - Cria `SubformLabor` com `timeMinutes = step.time_minutes * units`, `description = "<nome> (×<units> apostilas)"`, `stepType = step.step_type`, `parentItemId`.
   - Se não encontrou: cria labor avulso com 0 min e descrição `"Furação — preencher"` / `"Encadernação — preencher"`.
4. Toast resumindo: "Kit aplicado: X itens adicionados" + lista de fallbacks que precisam preenchimento.

## 3. Integração em `NewQuoteFormV2.tsx`

- Carrega `supplies` + `supplyTiers` (já carregados via `SupplySearch`/material drawer? — confirmar; senão buscar em `useEffect` para uso global).
- Renderiza `<SuggestBindingKitButton>` no header do bloco de filhos da Apostila, ao lado de "Sugeridos…", **somente quando** `m.bookletUnits > 0 && m.bookletPages > 0`.
- Reaproveita `setMaterials` / `setLabor` existentes (callbacks).

## 4. Precificação — sem mudanças no motor

Já está correto pelo trabalho anterior:
- Suprimentos com `supplyId` aplicam faixas `supply_pricing_tiers` automaticamente.
- `supplyDivisorFor(cm)` usa `cm.margemPct` se > 0, caso contrário a global → margem individual respeitada.
- Mão de obra entra via `laborDivisor` global.
- Sincronização Capa/Contracapa/Mola com `bookletUnits` já existe (`isPerBookletChild` cobre `mola|espiral|wire-?o`).

## 5. Critérios de aceite

- Apostila com 50 folhas × 10 unidades → kit insere Capa(×10), Contracapa(×10), Espiral 9mm(×10), Furação e Encadernação (tempo ×10).
- Botão é idempotente: clicar 2× não duplica.
- Se não há "Espiral 14mm" cadastrado para 80 fls → cria linha avulsa nomeada para o usuário completar.
- Preço final continua passando pelo divisor de venda; faixas de preço dos suprimentos respeitadas.

## Arquivos afetados

- **Novo:** `src/lib/quotes-v2/spiral-selector.ts`
- **Novo:** `src/components/orcamentos-v2/SuggestBindingKitButton.tsx`
- **Editado:** `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (renderiza o botão; expõe supplies/tiers se necessário)

Sem mudanças em banco, RLS, edge functions ou tipos gerados.
