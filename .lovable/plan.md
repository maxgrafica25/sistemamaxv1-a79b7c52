Aplicar o mesmo padrão da Impressão na aba **Apostila** (`BookletForm.tsx`): após selecionar o papel do miolo, esconder o campo "Miolo (papel do catálogo)" com a barra de busca. Para trocar, o usuário clica em "trocar" no card do papel já selecionado.

### Mudança
Em `src/components/orcamentos-v3/forms/BookletForm.tsx`, envolver o bloco `<Field label="Miolo (papel do catálogo)">` (linhas 169–185) em `{!catalog && (...)}`. O card de resumo + botão "trocar" (linhas 187–214) já existe e reaparece a busca ao limpar.

### Fora de escopo
- `CustomCoverEditor` (capa), `PrintForm` (já feito), demais formulários.
- Lógica de preço/kit/encadernação.

### Validação
Em `/orcamentos-v3/novo` → aba Apostila: antes de escolher miolo → busca visível. Depois → só o card. Clicar "trocar" → busca volta.