## Objetivo

Adicionar duas faces extras ao formulário **Certificados**:

- **Frente color + Verso PB** (mix)
- **Ambos PB** (F/V em preto e branco)

Total de 4 opções: `Frente color` (padrão), `Frente e Verso color`, `Frente color + Verso PB`, `Frente e Verso PB`.

## Mudanças

### `src/components/orcamentos-v3/forms/CertificateForm.tsx`

1. **Filtrar catálogo por modo** — separar `couche210A4Color` (`equipment_mode === "color"`) e `couche210A4Pb` (`equipment_mode === "pb"`). Aviso "Nenhum item cadastrado" só dispara se faltar `color`; faltar PB apenas desabilita as duas opções com mensagem inline.

2. **Estado de face** — trocar `"frente" | "fv"` por `"frente" | "fv" | "mix" | "fv_pb"`. Padrão continua `"frente"`.

3. **Cards do seletor (grid 2×2 em ≥sm)** — 4 cards com ícone/título/hint:
   - Frente — `FileText` — "1 face colorida" (padrão)
   - Frente e Verso — `Files` — "2 faces coloridas · custo ~2x"
   - Frente color + Verso PB — `FileText + FileMinus` — "F color + V P&B"
   - Frente e Verso (P&B) — `FileMinus` — "2 faces P&B · custo ~2x"

   Os dois cards PB ficam `disabled` (estilo `opacity-60 cursor-not-allowed`) se `couche210A4Pb` estiver vazio, com tooltip explicando.

4. **Cálculo de preço por folha** (`pricing` + `effectiveItem`):
   - `frente` / `fv` → 1 item color (lógica atual, `side = Frente | F/V`).
   - `fv_pb` → 1 item PB com `side = F/V`.
   - `mix` → soma de **dois `pricePerSheet`**: color Frente + PB Frente. `sellingPriceCombined = pColor.sellingPrice + pPb.sellingPrice`; `baseCostCombined = pColor.baseCost + pPb.baseCost`. Para o "tierLabel" exibido no header do catálogo, manter o do color (linha principal continua "Couchê 210 — A4 · color"). Adicionar uma segunda linha discreta "+ verso PB: Impressões Laser PB" quando aplicável.

5. **Header do catálogo** — quando `mix` ou `fv_pb`, mostrar a impressora correspondente. Em `mix`, listar as duas em duas linhas.

6. **Submit (`V3PrintItem` único)**:
   - `catalog_item_id` = item color (para `frente`/`fv`/`mix`) ou item PB (para `fv_pb`).
   - `printer_category_id` / `markup_group_id` = idem.
   - `valor_unitario` / `custo_unitario` = preço combinado por folha + acabamentos.
   - `side`: `"Frente"`, `"F/V"`, `"F/V"` (para mix, semanticamente F+V), `"F/V"`.
   - `face`: novo valor literal `"frente" | "fv" | "mix" | "fv_pb"`. **Verificar** que `V3PrintItem.face` aceita string livre; se for union restrita, ampliar o tipo em `src/components/orcamentos-v3/types.ts`.
   - `descricao` padrão:
     - `mix` → `"Certificado A4 — Couchê 210g · Frente color + Verso PB ({n} un)"`
     - `fv_pb` → `"Certificado A4 — Couchê 210g · Frente e Verso PB ({n} un)"`
     - demais inalterados.

### Tipos (se necessário)

Em `src/components/orcamentos-v3/types.ts`, verificar `V3PrintItem.face`. Se for union estrita (`"frente" | "fv"`), estender para `"frente" | "fv" | "mix" | "fv_pb"`. Nenhum consumidor a jusante precisa saber distinguir — UI/cart só renderiza `descricao`.

## Fora de escopo

- Dividir o item em dois no carrinho/OP (já descartado: "1 item só, somado").
- Aplicar o mesmo seletor ao Cartão de Visita ou outros presets.
- Considerar mix em qualquer outro lugar do sistema.

## Validação manual

Com `couche 210g A4 color` e `couche 210g A4 pb` cadastrados:

1. Trocar entre as 4 faces → header do catálogo e preço por folha atualizam.
2. `mix` com cores diferentes para 50 un → `preco_por_certificado ≈ pColor + pPb`.
3. Sem PB cadastrado → últimos dois cards desabilitados com mensagem.
4. Salvar orçamento → item aparece com descrição correta e preço somado.
