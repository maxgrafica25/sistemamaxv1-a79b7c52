## Refactor Novo Orçamento V2 — Layout Master-Detail

Eliminar o padrão de wizard por abas e adotar uma página única vertical e rolável, mantendo intactas a lógica de persistência, cálculos e o `StickyFinancialSidebar`.

### Arquivo afetado
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (única alteração estrutural)

### 1. Remoção do sistema de Steps
- Remover constante `STEPS` e estado `const [step, setStep] = useState(0)`.
- Remover ícones não usados após a refatoração: `ChevronLeft`, `ChevronRight`, `Check` (do step bar), e a navegação inferior "Voltar / Próximo".
- Remover renderização condicional `{step === N && ...}` — todas as seções passam a renderizar sempre.

### 2. Título "Notion-style"
Logo abaixo do header (h1 "Novo Orçamento V2" + ações), substituir o atual campo "Produto / Serviço" por um input seamless no topo da coluna principal:

```tsx
<input
  value={product}
  onChange={(e) => setProduct(e.target.value)}
  placeholder="Nome do Projeto / Orçamento..."
  className="w-full bg-transparent border-0 outline-none focus:ring-0
             text-3xl md:text-4xl font-bold text-primary
             placeholder:text-primary/30 px-0"
/>
```

O `product` continua sendo o mesmo state já persistido em `quotes.product` — sem mudança no schema.

### 3. Cabeçalho ultra-compacto (4 colunas)
Logo abaixo do título:

```tsx
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  Nº Orçamento (read-only) | Cliente (ClientCombobox) | Validade | Margem (%)
</div>
```

- Os botões "Dados do cliente / Últimas vendas" + painéis condicionais ficam logo abaixo do grid (col-span full).
- "Observações Gerais" passa a `rows={2}` em largura total.
- Manter o aviso "Comece com um modelo pronto" (apenas em criação) acima do grid, em formato discreto.

### 4. Seções verticais com Separator
Estrutura final da coluna principal:

```text
[Header com h1 + ações]
[Alertas: Locked / Approved warnings]
─────────────────────────
[Título seamless do projeto]
[Grid 4 col: Nº | Cliente | Validade | Margem]
[Painéis cliente expansíveis]
[Observações (rows=2)]
<Separator className="my-8" />
[H2: "Itens de Impressão"  + PrintingItemSearch + cards]
<Separator className="my-8" />
[H2: "Comunicação Visual"  + botão + Item CV cards + subtotal]
<Separator className="my-8" />
[H2: "Avulsos (não vinculados)" + LaborAndSupplySubform]
<Separator className="my-8" />
[H2: "Terceirizados" + lista]
<Separator className="my-8" />
[H2: "Desconto e Pagamento" + DiscountPaymentBlock]
[QuoteOptionsBuilder]
[Card final: Valor a cobrar + botão Salvar + Copiar link público]
```

Títulos de seção minimalistas (`h2 text-lg font-semibold flex items-center gap-2` com ícone Lucide em primary), sem `Card` envolvendo cada bloco — apenas o conteúdo direto, separado por `<Separator className="my-8" />`. Cards continuam sendo usados internamente onde já existem (PrintingItemEditor, CVItemCard).

### 5. Sticky Financial Sidebar
O componente `StickyFinancialSidebar` já é fixo no desktop (`sticky top-4` interno). Garantir que o wrapper externo permita o sticky funcionar com a página rolável:

- Container raiz mantém `flex flex-col lg:flex-row gap-6`.
- A `<aside>` interna do sidebar já tem `sticky top-4` — adicionar no wrapper `lg:self-start` para que o sticky respeite a altura do conteúdo principal mesmo com muitos itens.
- Sem alterações no componente `StickyFinancialSidebar.tsx`.

### O que NÃO muda
- Lógica de `loadInit`, `handleSave`, snapshot/recalculate, opções, CV, terceirizados.
- Schema de banco (`quotes.product` continua sendo o nome do projeto).
- Paleta roxa, radius e design tokens.
- Componente `StickyFinancialSidebar.tsx` permanece intacto.
- Imports de `STEPS`-related icons que ainda forem usados em outros lugares (Layers, Megaphone, Printer, Wrench, FileText, User).

### Resultado esperado
Uma página única, com título grande tipo Notion, cabeçalho denso em 4 colunas, e todas as seções (impressão, CV, avulsos, terceirizados, finalização) empilhadas verticalmente com separadores sutis. O painel financeiro acompanha o scroll permanentemente à direita (desktop) e como bottom bar (mobile, comportamento já existente).
