## Objetivo

Padronizar o cadastro de itens de impressão no orçamento (V2) com campos estruturados (Tipo de Material autocomplete, Largura/Altura em mm, Cor da Impressão), gerar automaticamente a descrição padronizada para o cliente e exibir, na visão interna, o cálculo de aproveitamento por folha de produção (328×478 mm).

---

## 1. Banco de dados (migration)

Adicionar à tabela `quote_materials`:

- `width_mm numeric` — largura do material em milímetros
- `height_mm numeric` — altura do material em milímetros
- `print_colors text` — uma de `4x4 | 4x0 | 1x1 | 1x0`

Sem default, nullable (compatível com itens existentes).
A tipagem `src/integrations/supabase/types.ts` é regenerada automaticamente.

---

## 2. Catálogo de Tipos de Material (autocomplete)

Em `src/lib/quotes-v2/item-title.ts`:

- Substituir o `Select` fixo de `PRODUCT_KIND_OPTIONS` por uma lista de **sugestões** usadas em autocomplete livre. O usuário pode escolher uma sugestão padronizada **ou** digitar a sua. Sugestões iniciais: Panfleto, Cartão de Visita, Tag, Apostila, Cartaz, Folder, Receituário, Adesivo, Convite, Bloco, Etiqueta, Impresso.
- Tratar `productKind` como string livre. Eliminar o caso especial "outro / customName" da UI (campo `customName` permanece no schema por compatibilidade mas não é mais usado pela interface).

---

## 3. Componente: PrintingItemEditor

Reorganizar o cabeçalho de atributos do item na ordem:

1. **Tipo de Material** (autocomplete, popover com sugestões filtradas — usando `Command`/`Popover` do shadcn, padrão já usado em `ClientCombobox`).
2. **Tamanho**: dois inputs numéricos (Largura, Altura) com sufixo "mm" e helper "Use milímetros". O campo legado `size` continua salvo como `${w}x${h}mm` para compatibilidade com filtros.
3. **Cor da Impressão**: `Select` com opções `4x4`, `4x0`, `1x1`, `1x0`. Esse valor grava em `print_colors`. O campo `side` continua sendo derivado (4x4/1x1 → "F/V"; 4x0/1x0 → "Simples") para manter os multiplicadores de preço atuais.
4. **Papel** continua vindo do seletor de catálogo (sem mudança).

Adicionar, abaixo do header de quantidade, um **bloco interno discreto** (badge cinza, ícone `Layers`):

```
Rendimento: X un/folha (orientação Y) · Total: Z folhas (328×478 mm)
```

Mostrado somente quando há largura, altura e quantidade > 0. Esse bloco **não** aparece em nenhum lugar visível ao cliente.

**Regra de segurança (não cabe na folha):**

- Se `calcSheetYield` retornar `null` **ou** `perSheet <= 0` (exemplo: material de 400×500 mm, maior que a folha útil 318×468 mm), o bloco de rendimento é substituído por um **alerta vermelho** (ícone `AlertTriangle` ou `AlertCircle`, texto vermelho escuro, fundo vermelho claro):

  > "Atenção: Material excede o tamanho da folha de produção"

- Esse aviso permanece visível enquanto o material não caber, garantindo que o orçamentista corrija os valores antes de prosseguir.

---

## 4. Função utilitária de aproveitamento

Novo arquivo `src/lib/quotes-v2/sheet-yield.ts`:

```ts
export const PRODUCTION_SHEET = { widthMm: 328, heightMm: 478 };
export const SAFETY_MARGIN_MM = 5;   // por lado
export const GUTTER_MM = 3;          // sangria/espaço entre unidades

export interface YieldResult {
  perSheet: number;
  orientation: "retrato" | "paisagem";
  sheetsNeeded: number;
  usableWidthMm: number;  // 318
  usableHeightMm: number; // 468
}

export function calcSheetYield(
  itemWidthMm: number,
  itemHeightMm: number,
  totalQty: number,
): YieldResult | null
```

Lógica:

- `usableW = 328 − 2·5 = 318`, `usableH = 478 − 2·5 = 468`.
- Para cada orientação (retrato `(w,h)` e paisagem `(h,w)`):
  - `cols = Math.floor((usableW + 3) / (sideW + 3))`
  - `rows = Math.floor((usableH + 3) / (sideH + 3))`
  - `per = cols * rows`
- Escolhe a orientação com maior `per`.
- `sheetsNeeded = Math.ceil(totalQty / per)` (retorna `null` se `per <= 0`).

Cobertura por testes unitários em `src/test/sheet-yield.test.ts` (panfleto 100×150 mm, cartão 90×50 mm, item maior que folha útil).

---

## 5. Descrição padronizada (visão do cliente)

Em `buildDynamicTitle` (`item-title.ts`), reescrever para o formato exato:

```
"<Tipo> <L>x<H>cm. Impressão <Cor>, <Papel> <Gramatura>"
```

Exemplo: `Panfleto 10x15cm. Impressão 4x4, Couchê 210g`.

Regras:

- Largura/altura convertidas de mm → cm com até 2 decimais, sem zeros à direita (`100 mm → "10"`, `105 mm → "10,5"`).
- Se `print_colors` ausente, derivar de `side` (F/V → 4x4, Simples → 4x0).
- Se papel ou gramatura faltarem, omitir a parte correspondente sem quebrar o restante.
- Acabamentos **não entram** mais nessa string — eles continuam sendo listados separadamente abaixo, exatamente como hoje (a UI do `ClientViewer` em `OptionCard`/lista já mostra `+ acabamentos` em linha separada).

---

## 6. Integração no NewQuoteFormV2

- Carregar `width_mm`, `height_mm`, `print_colors` do banco em `PricingMaterial` (estender o tipo em `src/lib/quotes-v2/pricing.ts`).
- No salvamento (`upsert quote_materials`), incluir os três novos campos e regravar `generated_title` usando o novo `buildDynamicTitle`.
- Quando o usuário escolhe um item do catálogo de impressão, **pré-preencher** `width_mm/height_mm` se o `size` do catálogo for um formato conhecido (ex: A4 → 210×297). Caso contrário, deixar em branco para o usuário preencher.
- Sem mudança em pricing/markup/desconto — apenas metadados e descrição.

---

## 7. Visão do cliente (ClientViewer)

Já usa `m.generated_title || m.description` em duas posições. Como o `generated_title` será regravado no novo formato no momento do save, o cliente passa automaticamente a ver a descrição padronizada. Os acabamentos continuam exibidos no `+ ...` logo abaixo. Nenhuma alteração de markup necessária aqui.

---

## Fora de escopo

- Recalcular `generated_title` para orçamentos antigos (vão continuar com a descrição que já tinham até serem reabertos e salvos).
- Usar a quantidade de folhas calculada para alimentar custo de papel — nesta entrega o cálculo é apenas informativo na visão interna.
- Permitir trocar o tamanho da folha de produção (328×478 fica fixo nesta versão).

## Arquivos afetados

- nova migration em `supabase/migrations/`
- `src/lib/quotes-v2/pricing.ts` (novos campos no tipo)
- `src/lib/quotes-v2/item-title.ts` (novo formato + lista de sugestões)
- `src/lib/quotes-v2/sheet-yield.ts` (novo)
- `src/test/sheet-yield.test.ts` (novo)
- `src/components/orcamentos-v2/PrintingItemEditor.tsx` (autocomplete + L/A + cor + bloco interno de rendimento + alerta vermelho)
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (load/save dos novos campos, regravar generated_title)