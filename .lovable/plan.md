
## Objetivo

1. Auto-preencher **nome do produto** ao colar URL (igual já faz com fornecedor).
2. Criar **catálogo central de produtos** que reúne variações do mesmo item entre fornecedores (ex: "Panfleto 10x14 couché 90g" da ANS = "Panfleto 10x15 couché 80g" da Atual Card).
3. Permitir **mesclar manualmente** produtos similares quando o sistema não identificar sozinho.
4. Servir de base para os **filtros de pesquisa** por produto.

## Mudanças no banco

**Nova tabela `produtos_catalogo`** — produto canônico:
```text
id, nome_canonico, categoria, dimensoes, gramatura, observacoes, created_at
```
RLS: authenticated full access (mesmo padrão das outras tabelas de monitoramento).

**Nova coluna em `sites_monitorados`**:
- `produto_catalogo_id uuid` — referência ao produto canônico (nullable).

`nome_produto` continua existindo (auditoria do nome bruto vindo do fornecedor). O agrupamento real acontece via `produto_catalogo_id`.

## Fluxo automático (NovoSiteDialog)

1. `detect-price-tiers` já retorna `produto` — auto-preencher campo `nome_produto` (editável).
2. Ao salvar, rodar **matcher fuzzy** no front:
   - Normaliza nome (mesma lógica do `productKey` em `Monitoramento.tsx`)
   - Busca em `produtos_catalogo` por chave similar
   - **Match** → vincula `produto_catalogo_id` existente
   - **Sem match** → cria novo registro no catálogo + vincula

## Fluxo manual de mesclagem

Novo botão **"Catálogo de Produtos"** na página Monitoramento abre um dialog:
- Lista produtos do catálogo com fornecedores vinculados (badge colorido por fornecedor)
- Ações:
  - **Mesclar 2+ produtos** (checkbox + botão "Mesclar"): move todos os `sites_monitorados` para o produto escolhido como mestre, apaga os duplicados
  - **Renomear** nome canônico
  - **Desvincular** site específico (cria novo produto canônico para ele)

## Impacto em Oportunidades

`Monitoramento.tsx` passa a agrupar oportunidades por `produto_catalogo_id` (em vez de `productKey` calculado). Fallback para `productKey` quando `produto_catalogo_id` for null (registros antigos).

Adiciona-se também um **filtro de produto** no topo da aba Oportunidades (dropdown listando produtos do catálogo).

## Arquivos afetados

- **Migration**: cria `produtos_catalogo` + coluna `produto_catalogo_id` em `sites_monitorados`
- `src/components/monitoramento/NovoSiteDialog.tsx`: auto-preencher nome + matcher/create no catálogo ao salvar
- `src/pages/Monitoramento.tsx`: agrupar por `produto_catalogo_id`, novo filtro de produto, botão "Catálogo"
- **Novo** `src/components/monitoramento/CatalogoProdutosDialog.tsx`: gerencia mesclar/renomear/desvincular

## Limitação honesta

Matcher automático erra em casos sutis (couché 80 vs 90, 10x14 vs 10x15). A tela de mesclagem manual resolve isso de uma vez — depois que o usuário mescla, o vínculo persiste para sempre.
