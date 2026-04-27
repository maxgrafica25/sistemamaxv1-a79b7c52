# Reposicionar botão "Novo Suprimento / Novo Papel"

## Por quê

Hoje o botão fica no topo da seção de tabs, longe da tabela que ele afeta. Boa notícia: o label **já é dinâmico** (muda entre "Novo Papel" e "Novo Suprimento" conforme a tab ativa), então só falta corrigir a **posição**.

## O que muda visualmente

**Antes:**
```text
[ Tabs: Papéis • Suprimentos ]                    [+ Novo Suprimento]
[ Card: Itens ]  [ Card: Formato ]  [ Card: Alertas ]
[ 🔍 Buscar suprimento... ]   [ Filtro ▼ ]
[ Tabela ... ]
```

**Depois:**
```text
[ Tabs: Papéis • Suprimentos ]
[ Card: Itens ]  [ Card: Formato ]  [ Card: Alertas ]
[ 🔍 Buscar suprimento... ]   [ Filtro ▼ ]   [+ Novo Suprimento]
[ Tabela ... ]
```

Padrão usado por Linear, Notion, Stripe, Airtable: ação principal **colada ao conteúdo** que ela cria.

## Benefícios

1. **Contexto inequívoco** — o botão fica visualmente dentro da seção da tabela, sem dúvida sobre o que vai criar.
2. **Lei de Fitts** — o olho não precisa subir até o topo para criar e descer para conferir.
3. **Header limpo** — título + descrição respiram melhor, hierarquia visual mais clara.
4. **Continua responsivo** — em telas estreitas, `flex-wrap` faz o botão descer para a próxima linha naturalmente.

## Mudança técnica

Arquivo único: `src/pages/MateriasPrimas.tsx`

- Remover o `<Button>` da linha 484-487 (linha do header das tabs).
- Adicionar o mesmo `<Button>` no final do bloco "Search & Filters" (linha 526-551), depois dos selects de filtro/ordenação.
- Manter o label dinâmico (`Novo {activeTab === "papel" ? "Papel" : "Suprimento"}`) e os handlers existentes (`openPaperDialog` / `openNewDialog`).
- Nenhuma mudança de lógica, estado ou banco de dados.

Risco: praticamente zero. É uma realocação visual de um botão existente.
