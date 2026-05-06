Adicionar coluna **Data** na tabela de orçamentos (OrcamentosV2), posicionada logo após a coluna **Nº**.

### Alteração
- **Arquivo:** `src/pages/orcamentos-v2/OrcamentosV2.tsx`
- **Header da tabela:** inserir `<th>Data</th>` entre as colunas "Nº" e "Cliente".
- **Linhas da tabela:** inserir `<td>` formatando `q.date` para `toLocaleDateString('pt-BR')` na mesma posição.

O campo `date` já está presente no tipo `QuoteRow` e já é retornado pela query do Supabase, então nenhuma mudança de backend é necessária.