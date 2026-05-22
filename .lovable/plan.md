## Plano

Hoje os presets (Banner, Lona, Adesivo, Cartão de Visita, Apostila, Folheto, etc.) estão fixos no código. Vou criar um cadastro próprio para você criar/editar/excluir esses presets, que aparecerão automaticamente nos dois módulos: "Impressão + Acabamentos" e "Comunicação Visual" (CV).

### 1. Nova tabela `quote_presets`

Campos:
- `nome` — texto exibido no chip (ex.: "Banner", "Cartão de Visita").
- `icone` — nome do ícone Lucide (ex.: `Megaphone`, `CreditCard`). Lista pré-definida no select.
- `modulo` — `cv`, `impressao` ou `ambos` (controla em qual aba aparece).
- `form_tipo` — só para Impressão: `print`, `booklet` ou `label`.
- `ativo`, `ordem`.

Hints (todos opcionais):
- `largura_cm`, `altura_cm`, `quantidade_padrao`
- `is_banner` (booleano, só CV)
- `midia_tipo` (`lona`/`adesivo`/`chapa`, só CV)
- `midia_nome_match` (texto para filtrar mídia, ex.: "brilho 440")
- `papel_inclui` (lista, só Impressão — ex.: ["couchê 250", "supremo"])
- `papel_exclui` (lista)
- `acabamentos_sugeridos` (lista de nomes)

RLS: leitura para usuários autenticados, escrita só para admin (igual a `produtos_catalogo`).

Seed inicial com os presets atuais (Banner, Lona, Adesivo, Faixa, Folheto, Cartão, Apostila, Etiqueta) para não perder o comportamento de hoje.

### 2. Nova página `/configuracoes/presets-orcamento`

Lista + dialog de edição estilo `src/pages/Produtos.tsx`, com:
- Filtro por módulo (CV / Impressão / Ambos).
- Drag-and-drop ou campo numérico para ordem.
- Pré-visualização do ícone selecionado.
- Restrita a admin (mesma `AdminOnly`/`requireAdmin` já usada).

Adicionar item de menu em **Configurações** apontando para a nova página.

### 3. Substituir os arrays hardcoded pelos dados do banco

- Criar hook `useQuotePresets(modulo)` que carrega da tabela e cacheia.
- Em `CVForm.tsx`: trocar `CV_PRESETS` por `useQuotePresets("cv")`.
- Em `PrintAndProductForm.tsx`: trocar `PRODUCT_PRESETS`/`productPresets.ts` por `useQuotePresets("impressao")`.
- Manter os ícones via mapa `LUCIDE_BY_NAME` (segurança contra ícone inválido — fallback para `Wand2`).

### Fora do escopo
- Mudanças no engine de cálculo, em mídias/acabamentos do catálogo CV ou em papéis.
- Permitir o usuário "colaborador" criar presets (continua só admin).

Posso seguir?