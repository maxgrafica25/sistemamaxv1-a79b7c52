

# Limpar registros 4x4 órfãos e enriquecer feedback de duplicata

## Decisões confirmadas

- **Manter** apenas o produto canônico **"Panfletos 10x14cm (A6) - Couchê 90g - Impressão Offset - 4x0 cor"** e seus respectivos sites cadastrados.
- **Excluir** os 3 registros 4x4 que foram criados acidentalmente (ANS, Atual Card, Futura IM) — eles travam o recadastro e são órfãos da tentativa anterior.
- O 4x4 cor é um **produto novo** que será cadastrado pelo usuário do zero após a limpeza, no fluxo normal do `NovoSiteDialog`.

## Parte 1 — Limpeza cirúrgica no banco

DELETE em `sites_monitorados` filtrando pelas 3 URLs 4x4 identificadas:

```sql
DELETE FROM sites_monitorados
WHERE url_completa IN (
  'https://www.ans.com.br/panfleto-90gr/',
  'https://www.atualcard.com.br/flyer/.../22549',           -- URL exata da Atual Card 4x4
  'https://www.futuraim.com.br/produto/...?id=5592'         -- URL exata da Futura IM 4x4
);
```

Cascata via FK ON DELETE CASCADE remove automaticamente: `site_precos_tiers`, `historico_precos`, `historico_precos_tiers`, `alertas_precos` desses sites.

**Não toca** em `produtos_catalogo` — o produto canônico 4x0 e qualquer outro produto permanecem intactos.

Antes do DELETE confirmo as URLs exatas via `read_query` (já validei os IDs `0dd91da9...` ANS; preciso reconfirmar IDs/URLs exatos da Atual Card e Futura IM no momento da execução).

## Parte 2 — Enriquecer o AlertDialog de duplicata em `NovoSiteDialog.tsx`

Para evitar repetição do problema, ampliar a query de pré-checagem e mostrar contexto suficiente para o usuário decidir o que fazer:

**Query** (substitui o select atual):
```ts
.select("id, url_completa, nome_produto, fornecedor_nome, ativo, preco_atual, timestamp_check")
```

**UI do AlertDialog** — para cada URL duplicada exibir uma linha com:
- Nome do produto + nome do fornecedor (já existe)
- **Badge** "Ativo" (verde) ou "Inativo" (cinza)
- **"Última coleta: dd/mm hh:mm"** ou **"Sem preço coletado"** se `timestamp_check` for null
- Botão pequeno **"Abrir URL"** (`<a target="_blank">` com ícone `ExternalLink`) ao lado para conferir

**Botões do diálogo**:
- Se houver pelo menos 1 URL nova: **"Ignorar duplicadas e salvar o resto"** + **"Cancelar"**
- Se 100% forem duplicatas: **"Cancelar"** + **"Ir para Gerenciar sites"** (já existe)

## Arquivos afetados

- **Operação no banco** — DELETE das 3 linhas 4x4 (com confirmação prévia das URLs via SELECT).
- `src/components/monitoramento/NovoSiteDialog.tsx` — ampliar query de pré-checagem e enriquecer linhas do AlertDialog com badge de status, última coleta e botão "Abrir URL".

## Fora de escopo

- `produtos_catalogo`, `ProductPicker`, lógica de scraping, RLS, triggers — intactos.
- Não adicionar botão "Excluir e recadastrar" inline no diálogo (decisão postergada — ainda dá pra usar a aba Gerenciar sites).

## Risco

Mínimo. DELETE filtrado por URLs específicas confirmadas previamente. A mudança no AlertDialog é só visual — query continua read-only.

