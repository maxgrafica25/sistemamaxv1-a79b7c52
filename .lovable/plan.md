## Problema
Na página pública do orçamento (`ClientViewer.tsx`), os processos de produção (acabamentos vinculados via `parent_item_id`) são exibidos apenas como uma mensagem genérica no rodapé: "Inclui mão de obra especializada (X etapas)". O cliente final não vê quais acabamentos foram aplicados a cada item de impressão.

## Solução
Listar os nomes dos processos filhos diretamente abaixo do título de cada item de impressão, dentro do mesmo card, em fonte menor e cor secundária.

### Alterações em `src/pages/orcamentos-v2/ClientViewer.tsx`

1. **Buscar `parent_item_id` nas etapas de mão de obra** (query em `loadData`):
   - Atualizar o `select` da tabela `quote_labor_steps` para incluir `parent_item_id`.
   - Atualizar o tipo `LaborRow` correspondente.

2. **Agrupar labor por parent**:
   - Criar um `useMemo` que monta um `Map<string, LaborRow[]>` agrupando etapas por `parent_item_id` (ignorando as órfãs/sem parent — essas continuarão fora da listagem por item).

3. **Renderizar dentro do card de cada item de impressão** (loop dos `materials`, ~linha 517):
   - Logo abaixo do `<p>{m.generated_title || m.description}</p>`, se houver labor children para `m.id`, renderizar uma lista compacta:
     ```tsx
     {childLabor.length > 0 && (
       <p className="text-xs text-muted-foreground mt-1">
         + {childLabor.map(l => l.description).join(", ")}
       </p>
     )}
     ```
   - Mantém estilo discreto (cinza, fonte pequena), formato: `+ Laminação Fosca, Corte e Vinco, Furo`.

4. **Remover o bloco genérico** (linhas 548–554):
   - Excluir o `{labor.length > 0 && (...)}` com "Inclui mão de obra especializada".

### Comportamento
- Etapas órfãs (sem `parent_item_id`) — se existirem em orçamentos antigos — deixam de aparecer na visualização pública. Como o custo dessas etapas já está incluído no `unit_price` dos itens via cálculo do orçamento, isso não afeta valores exibidos.
- Itens sem processos filhos continuam exibidos sem nenhuma linha extra.

### Arquivo único alterado
- `src/pages/orcamentos-v2/ClientViewer.tsx`
