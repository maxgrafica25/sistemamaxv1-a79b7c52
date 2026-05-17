## Causa do bug

O engine atual calcula **por unidade** e faz `ceil(unitário) × qtd`:

```
6×6cm × 1000 → área_un = 0,0036 m²
preço_un ≈ 0,33  →  ceil(0,33) = 1,00  →  total = 1000,00
```

A planilha calcula sobre **área total** (`9×9 = 81` ou `0,0036×1000 = 3,6 m²`) e arredonda **uma única vez** no total. Por isso o valor correto é R$ 576 (≈ R$ 0,576/un) — e não R$ 1.000.

## Mudança de modelo

Trocar para **job único** em todo o engine `cv-calc/engine.ts`:

| Componente            | Antes (por un.)         | Depois (job único)              |
|-----------------------|-------------------------|---------------------------------|
| custo/lucro **m²**    | × área_un               | × área_total (qtd × área_un)    |
| custo/lucro **perímetro** | × perim_un          | × perim_un × qtd                |
| custo/lucro **unidade**   | × 1                 | × qtd                           |
| custo/lucro **fixo**      | × 1                 | × 1 (setup único)               |
| **Valor mínimo (R$35)**   | aplicado no unitário | aplicado no **total**          |
| **Arredondamento (ceil R$1)** | no unitário     | no **total**                    |
| `valor_unitario`          | base do cálculo     | derivado: `total / qtd`         |

Validação do caso adesivo (parâmetros exemplo do user):
```
área_total = 3,6 m²
impressão + mídia = 315,64
acabamento (recorte + cartelas) = 260,07
subtotal = 575,71  →  ceil = 576 ✅
```

## Impacto nos testes existentes

Os testes atuais (`90×120 = 132`, `100×300 qtd=3 = 855` etc.) foram calibrados pro modelo per-unit. Com o modelo job único:

- **qtd=1** → resultado quase idêntico (mudança só vem do ceil R$1 sobre total). Provável que `132`, `135`, `205`, `285`, `301`, `365` continuem batendo.
- **qtd=3 100×300** → muda (perde economia de setup × 3 da impressão). Precisa recalibrar com a planilha.

Vou recalcular cada caso e **atualizar `src/test/cv-calc.test.ts`** com os valores que o modelo novo produz, antes de pedir validação visual.

## Arquivos alterados

1. **`src/lib/cv-calc/engine.ts`** — refator do `calcular()`:
   - `area_total = area_un × qtd`, `perim_total = perim_un × qtd`
   - todos os componentes m²/perímetro/unidade multiplicados por qtd
   - `custo_fixo` / `lucro_fixo` permanecem **uma vez** (setup)
   - `aplicou_minimo` e `ceil` movidos pro **total**
   - `valor_unitario = valor_total / qtd` (apenas para exibição)
   - seleção automática de bastão: `qtd_unidades = pick.info.qtd × qtd` (3 banners × 1 bastão cada)

2. **`src/test/cv-calc.test.ts`** — atualizar valores esperados (especialmente caso qtd=3) após validar contra a planilha.

3. **`src/components/cv-calc/CalculadoraTab.tsx`** — pequeno ajuste no card "Resultado": destacar o **Total** quando qtd > 1 (o unitário continua aparecendo, mas como linha secundária derivada).

4. **`src/components/orcamentos-v2/CVItemCard.tsx`** — se exibe `valor_unitario` em destaque, trocar pra `valor_total` (a tela do orçamento se preocupa com o total do item). Vou conferir o componente antes de editar.

## Fora de escopo

- Estrutura das tabelas `cv_calc_*` não muda.
- Modo "múltiplo acabamento" (orçamento V2) continua funcionando — apenas o cálculo subjacente passa a usar área total.
- Engine legado `src/lib/cv-pricing/engine.ts` (que já usava modelo job-único) não é tocado.

## Próximo passo após aprovar

Implemento o engine novo, rodo `cv-calc.test.ts`, ajusto os números esperados conforme cálculos da planilha, e te mostro o teste 6×6 × 1000 batendo R$ 576.