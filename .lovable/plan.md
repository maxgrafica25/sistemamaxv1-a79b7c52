

## Entendimento

Reformular o fluxo em 3 mudanças:

### 1. Pré-cadastro de "Produtos" (catálogo manual)
Criar uma tela onde o usuário cadastra **manualmente** uma lista de produtos canônicos (ex: "Panfleto 10x14 Couché 90g", "Cartão de Visita 9x5 Couché 300g"). Estes ficam disponíveis como "biblioteca de nomes".

### 2. Ao adicionar site (NovoSiteDialog) — substituir matching automático por seletor explícito
Após detectar preços do link, antes de salvar, mostrar dois caminhos claros:
- **Combobox** com todos os produtos do catálogo (busca por nome) — escolhe um existente
- **Campo de texto** — digita um nome novo (cria entrada no catálogo)

Sem sugestões automáticas por dimensão (causou confusão). O usuário decide.

### 3. Catálogo — unificar 2+ produtos preservando links
No `CatalogoProdutosDialog`:
- Selecionar 2+ produtos (já existe)
- Botão "Unificar" → escolhe qual nome canônico manter → todos os `sites_monitorados` dos outros produtos passam a apontar pro produto escolhido → produtos vazios são deletados
- **Cada site mantém seu `url` original intacto** (a unificação só altera `produto_catalogo_id`, não toca em URL/fornecedor/preços)

Resultado: a tela de Monitoramento agrupa por `produto_catalogo_id` e mostra preços de todos os fornecedores lado a lado, mas cada linha mantém link próprio pro site original.

## Arquivos afetados

**Novo:**
- `src/pages/Produtos.tsx` — CRUD da biblioteca de nomes (lista, adicionar, editar, excluir)
- Rota `/produtos` no `App.tsx` + item no `Layout.tsx`

**Modificar:**
- `src/components/monitoramento/NovoSiteDialog.tsx`:
  - Remover `SugestoesCatalogoInline` e `ConfirmarNomeDialog` da UI
  - Adicionar **seletor** (Combobox de produtos do catálogo) + opção "Criar novo nome" com input de texto
  - Ao salvar: usa `produto_catalogo_id` selecionado OU cria novo via `findOrCreateCatalogo`
- `src/components/monitoramento/CatalogoProdutosDialog.tsx`:
  - Reformular `handleMerge` (ele já existe parcialmente) — adicionar passo de **escolher qual nome manter** antes de unificar
  - Garantir que apenas `produto_catalogo_id` muda nos sites; nada de mexer em url/preço/fornecedor
- `src/lib/produtoCatalogo.ts`: manter `findOrCreateCatalogo`; remover/deprecar funções de match por dimensão (não usadas mais)

**Remover (não usados mais):**
- `src/components/monitoramento/SugestoesCatalogoInline.tsx`
- `src/components/monitoramento/ConfirmarNomeDialog.tsx`

## Fluxo final (visual)

```text
[Tela Produtos]               [NovoSiteDialog]                [Catálogo]
─────────────                 ────────────────                ──────────
+ Panfleto 10x14              URL: imprimarapido.com/...      [✓] Panfleto 10x14
+ Cartão Visita 9x5           Preços detectados ✓             [✓] Flyer 10x14
+ Flyer 14x10                                                  [Unificar →]
                              Vincular ao produto:               ↓
                              ◉ Selecionar existente:          Manter nome:
                                [Panfleto 10x14 ▾]            ◉ Panfleto 10x14
                              ○ Criar novo nome:               ○ Flyer 10x14
                                [____________]                  [Confirmar]
                              [Salvar]                         (URLs preservados)
```

## Limitação honesta

A unificação é destrutiva (deleta produtos vazios do catálogo). Vou pedir confirmação dupla. Os sites/preços/URLs nunca são tocados — só o `produto_catalogo_id` deles muda.

