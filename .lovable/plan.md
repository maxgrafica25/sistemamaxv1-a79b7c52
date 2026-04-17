

## Objetivo

Quando o usuário cadastrar um novo produto, o sistema detecta dimensões/características e sugere reutilizar o **nome canônico** de um produto já existente no catálogo — garantindo que produtos equivalentes de fornecedores diferentes fiquem com **exatamente o mesmo nome** (mas mantendo preços individuais por fornecedor).

## Como funciona

Em `NovoSiteDialog.tsx`, após `detect-price-tiers` retornar e auto-preencher `nome_produto`:

1. Extrair dimensões do nome detectado (regex em `productKey`, normaliza ordem: sempre menor x maior).
2. Buscar em `produtos_catalogo` produtos com **dimensões equivalentes** (tolerância ±1cm, ex: 10x14 ≈ 10x15).
3. Se houver match(es) → mostrar **dropdown inline de sugestões** abaixo do campo "Nome do produto":

```text
Nome do produto: [Folder A6 Reduzido 10x14cm Couché 90g_______]

💡 Produtos similares no catálogo (10x14cm):
   ┌─────────────────────────────────────────┐
   │ ✓ Panfleto 10x14 Couché 90g             │
   │   Já vinculado: ANS                     │
   │   [Usar este nome]                      │
   ├─────────────────────────────────────────┤
   │ ✓ Flyer 10x14 Couché 80g                │
   │   Já vinculado: Atual Card              │
   │   [Usar este nome]                      │
   └─────────────────────────────────────────┘
   ou continue digitando para criar novo produto
```

4. Ao clicar **"Usar este nome"**:
   - Substitui o `nome_produto` pelo nome canônico existente
   - Marca internamente o `produto_catalogo_id` para vincular direto ao salvar (pula `findOrCreateCatalogo`)
5. Se ignorar e salvar com nome diferente → fluxo normal cria novo produto no catálogo.

## Critério de match

- **Apenas dimensões** (com tolerância ±1cm em cada lado) — sem considerar gramatura, papel ou categoria.
- Mantém simples: o usuário decide se faz sentido reutilizar olhando os nomes sugeridos.
- Ordena sugestões por: produtos com mais fornecedores vinculados primeiro (mais "estabelecidos").

## Arquivos afetados

- `src/lib/produtoCatalogo.ts` — adiciona `extractDimKey(name)` + `findCatalogoSimilarByDim(dimKey)` que retorna produtos do catálogo com contagem de fornecedores
- `src/components/monitoramento/NovoSiteDialog.tsx`:
  - Novo state `sugestoesCatalogo` + `produtoCatalogoIdEscolhido`
  - `useEffect` dispara busca de sugestões quando `nome_produto` muda
  - Bloco inline de sugestões abaixo do campo nome (visível apenas quando há matches)
  - Ao salvar: se `produtoCatalogoIdEscolhido` está set, usa direto; senão chama `findOrCreateCatalogo` normal

## Limitação honesta

Tolerância ±1cm pode trazer falsos positivos (10x14 vs 10x15 podem ser produtos legitimamente diferentes). Por isso é **sugestão visível, nunca automática** — o usuário sempre escolhe se aceita ou ignora.

