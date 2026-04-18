
O usuário quer cadastrar múltiplos sites de uma vez colando vários links (de fornecedores diferentes) numa única ação. Hoje o `NovoSiteDialog` só aceita 1 URL por vez em cada aba.

Preciso entender o fluxo atual: a aba "tiers" do `NovoSiteDialog` chama `detect-price-tiers` (Firecrawl) que retorna nome do produto, fornecedor e tabela de preços por quantidade. Depois `doSaveTiers` salva em `sites_monitorados` + `site_precos_tiers`, vinculando ao catálogo via `findOrCreateCatalogo`.

Para fazer cadastro em massa, posso adicionar uma nova aba "Em massa" com:
1. Textarea pra colar N URLs (uma por linha).
2. Botão "Detectar todos" que processa cada URL em sequência (1 por vez para não estourar Firecrawl), mostra progresso e resultado por linha.
3. Para cada URL: chama `detect-price-tiers`, exibe nome+fornecedor+tiers detectados, com checkbox para incluir/excluir antes de salvar.
4. Botão "Salvar selecionados" insere todos de uma vez, usando `findOrCreateCatalogo` e `checkDuplicate` (URL) por item.

Isso reaproveita 100% da lógica atual sem mudanças no banco.

## Plano

**Nova aba "Em massa"** em `src/components/monitoramento/NovoSiteDialog.tsx`:

1. **Input**: textarea para colar URLs (uma por linha). Validação: mínimo 1 URL válida.

2. **Processamento sequencial** ao clicar "Detectar todos":
   - Para cada URL: chamar `detect-price-tiers` (1 por vez, com pequeno delay para evitar rate limit).
   - Exibir progresso: "Processando 3 de 8…".
   - Resultados em lista com cards expansíveis mostrando: status (ok/erro/duplicado), URL, fornecedor detectado, nome do produto, qtd. de tiers encontrados.
   - Marcar automaticamente como "duplicado" se a URL já existir (usar `checkDuplicate`).

3. **Edição rápida por item**:
   - Cada card permite ajustar nome do produto e fornecedor antes de salvar.
   - Checkbox "incluir no salvamento" (desmarcado para erros/duplicados por padrão).

4. **Salvar em lote**:
   - Botão "Salvar X itens selecionados".
   - Para cada item válido: `findOrCreateCatalogo(nome, "impressao")` → insert em `sites_monitorados` → insert em `site_precos_tiers` (todos os tiers detectados).
   - Toast final com resumo: "5 cadastrados, 1 erro, 2 duplicados ignorados".

5. **UX**: barra de progresso visível durante detecção; permite cancelar; botão "Limpar" para recomeçar.

## Arquivos afetados

- `src/components/monitoramento/NovoSiteDialog.tsx` — adicionar aba "Em massa" com toda a lógica acima. Reaproveita helpers existentes (`checkDuplicate`, `findOrCreateCatalogo`, `extractDomainName`).

Sem alterações no banco de dados.
