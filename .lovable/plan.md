## Objetivo

Reformular **Orçamentos V2** para um layout linear no estilo **Tiny ERP**, com tabela de itens, busca inline, e blocos comerciais bem separados. Substitui o atual visual "Notion" (título gigante + cards expansíveis) por um formulário denso e familiar para quem vem de ERP.

## Layout final

```text
Proposta Comercial
─────────────────────────────────────────────────────────────
[ Nº Proposta ] [ Cliente* (busca) ] [ Aos cuidados de ] [ Validade (dias) ]
   dados do cliente · ver últimas vendas · pessoas de contato

[ Vendedor ] [ Data ] [ Próximo contato ]

Introdução
[ textarea curta — opcional ]
─────────────────────────────────────────────────────────────
[ Itens de produto ou serviço | Descrições complementares ]

┌──┬──────────────────────────────┬──────┬──────┬──────────┬─────────────┬────┐
│Nº│ Item (busca catálogo)        │ Qtde │  UN  │ Preço un │ Preço total │ ⋮  │
├──┼──────────────────────────────┼──────┼──────┼──────────┼─────────────┼────┤
│ 1│ [combobox vazio + busca]     │      │      │          │             │ ⋮  │
└──┴──────────────────────────────┴──────┴──────┴──────────┴─────────────┴────┘
   + adicionar item        🔍 busca avançada de itens

Outros itens ou serviços (avulsos + terceirizados — mesma estrutura tabular)

Observações
[ textarea ]
─────────────────────────────────────────────────────────────
Frete & Outros
  [ Tipo de frete ▾ ]  [ Valor frete R$ ]
  [ Outros valores ocultos R$ ]   ← dilui no total, não aparece no PDF

Condições Comerciais
  Forma de pagamento [ select ]
  Desconto [ valor / % ]

Marcadores  [ tag1 ][ tag2 ][ + ]
─────────────────────────────────────────────────────────────
Comparativo de Quantidades (Ancoragem)
  Quantidade desejada [ 1000 ]   chips: 500 · 1000 · 2000 · +
─────────────────────────────────────────────────────────────
[ Salvar ]   [ Cancelar ]   ← rodapé fixo
```

## Mudanças por bloco

### 1. Header (linha única + linha secundária)
- Linha 1: **Nº Proposta · Cliente · Aos cuidados de · Validade**.
- Linha 2: **Vendedor · Data · Próximo contato** (campos visuais por enquanto, sem persistir Vendedor/Próximo contato — nova iteração depois).
- Remove o título grande "Nome do Projeto" do topo. Esse campo (`product`) volta como input discreto dentro de Introdução, label "Assunto do Orçamento".
- Remove header "Editar/Novo Orçamento V2" + botões Salvar/Cancelar do topo (vão pro rodapé fixo).

### 2. Tabs
`Itens de produto ou serviço` (default) e `Descrições complementares` (textarea grande para "Observações Gerais").

### 3. Tabela de Itens — `QuoteItemsTable.tsx` (novo)

Colunas: `Nº · Item · Qtde · UN · Preço un · Preço total · Ação(⋮)`

- Sempre inicia com 1 linha vazia (regra já acordada).
- **Item**: combobox com busca no catálogo de impressão + CV. Ao escolher:
  - preenche descrição
  - puxa preço unitário automaticamente baseado no markup tier ativo
  - calcula preço total = qtde × preço un
- **Qtde / Preço un**: inline editáveis (sobrescrever preço quando vendedor quer ajustar).
- **⋮ "Editar detalhes"**: abre **Drawer lateral** (`Sheet`) com o `PrintingItemEditor` ou `CVItemCard` atual lá dentro — preserva toda a lógica de papel, frente/verso, mão-de-obra filha, materiais filhos, acabamentos.
- Abaixo da tabela: link `+ adicionar item` e `🔍 busca avançada` (drawer com filtros por papel/gramatura/equipamento).

### 4. Outros itens ou serviços
Tabela compacta única que agrupa **Avulsos** (mão-de-obra/materiais sem item pai) e **Terceirizados** com coluna "Tipo" para diferenciar. Mesmo visual da tabela principal.

### 5. Frete & Outros
- `FreightSelector` (já existe) — Tipo de frete + Valor.
- "Outros valores (oculto)" — dilui no total sem aparecer no PDF.
- Link discreto: "Cadastrar tipos de frete em Configurações → Empresa".

### 6. Condições Comerciais
- Forma de pagamento (já existe via `DiscountPaymentBlock`).
- Desconto valor/%.

### 7. Marcadores
`TagInput` (já existe) com sugestões dos orçamentos anteriores.

### 8. Ancoragem
`QuoteOptionsBuilder` movido para o **fim**, dentro de bloco "Comparativo de Quantidades", logo acima do rodapé. Quantidade principal vira o input ao lado dos chips (não duplicar com o cabeçalho).

### 9. Rodapé fixo
`[Salvar] [Cancelar]` fixo no bottom (mobile-friendly), com badges de versão/travado deslocados para um header secundário simples.

### 10. Sidebar financeira
Mantida em `lg:` com totais ao vivo; em telas menores vira drawer/colapsável.

## Detalhes técnicos

- **Sem migração** — todos os campos já existem (`attention_to`, `freight_value`, `freight_type_id`, `hidden_extras_value`, `tags`, `main_quantity`).
- Novo: `src/components/orcamentos-v2/QuoteItemsTable.tsx` (tabela + combobox de busca + cálculo preço un).
- Novo: `src/components/orcamentos-v2/QuoteItemDetailsDrawer.tsx` (Sheet wrapper que renderiza `PrintingItemEditor` ou `CVItemCard`).
- Novo: `src/components/orcamentos-v2/OtherItemsTable.tsx` (avulsos + terceirizados unificados).
- Refatorar `NewQuoteFormV2.tsx`:
  - Remover bloco grande "Nome do Projeto" e bloco roxo de "Quantidade desejada" do topo.
  - Header com grid `Nº · Cliente · Aos cuidados · Validade` + linha `Vendedor · Data · Próximo contato`.
  - Tabs (`@/components/ui/tabs`).
  - Trocar o map de `PrintingItemEditor` cards pela `QuoteItemsTable`.
  - Mover `QuoteOptionsBuilder` para o final.
  - Mover Salvar/Cancelar para `<footer>` fixo.

## Fora de escopo (próximas iterações)
- Persistir Vendedor (precisa vincular a `user_roles` / membros) e Próximo contato (nova coluna).
- Endereço de entrega alternativo.
- Campo "Lista de preço" (precisa modelo de tabelas de preço).
