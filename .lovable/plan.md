## Acrescentar hora à data de criação dos orçamentos

Atualmente a listagem em `/orcamentos-v2` mostra apenas a data (ex: `08/05/2026`). Vamos passar a exibir data + hora (ex: `08/05/2026 14:32`).

### Alterações

**`src/pages/orcamentos-v2/OrcamentosV2.tsx`**

1. **Linha ~416** (coluna "Data" da tabela de orçamentos): trocar
   ```ts
   new Date(q.date).toLocaleDateString("pt-BR")
   ```
   por uma formatação que inclui hora/minuto:
   ```ts
   new Date(q.date).toLocaleString("pt-BR", {
     day: "2-digit", month: "2-digit", year: "numeric",
     hour: "2-digit", minute: "2-digit"
   })
   ```
   Resultado: `08/05/2026 14:32`.

2. **Linha ~160** (template HTML usado na impressão/exportação da lista): aplicar o mesmo formato para manter consistência.

### Fora do escopo
- Tela de visualização do orçamento pelo cliente (`ClientViewer`) e demais páginas — apenas a listagem foi solicitada. Posso estender depois se quiser.