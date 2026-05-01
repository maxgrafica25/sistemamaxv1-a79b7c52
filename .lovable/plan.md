## Objetivo

Replicar o comportamento do Tiny ERP: abaixo do campo Cliente (após selecionado), exibir dois links/botões discretos:

- **Dados do cliente** — abre/fecha um painel inline com os dados cadastrais (empresa, CNPJ, endereço completo, telefone, email, etc), permitindo edição rápida e persistência sem sair do orçamento.
- **Últimas vendas** — abre/fecha um painel inline com os últimos orçamentos/pedidos do cliente (descrição, valor, data, status, número), com link para abrir o orçamento original em nova aba.

Toggle puro: clicou abre, clicou de novo recolhe. Sem reload da página.

## Escopo (apenas Orçamentos V2)

Aplicar no `NewQuoteFormV2.tsx` (etapa 0 — Informações). Não modificar V1, não modificar pedidos.

## Componentes a criar

### 1. `src/components/orcamentos-v2/ClientDetailsPanel.tsx`
- Props: `clientId: string`, `onUpdated?: () => void`
- Faz `select *` em `clients` quando aberto pela primeira vez (cache local).
- Layout em grid 2 colunas: Tipo de Pessoa (deduzido pelo CNPJ vs CPF — usamos só CNPJ por enquanto), CNPJ, Empresa, Email, Telefone, CEP, Endereço, Número, Complemento, Bairro (não temos coluna — omitir), Município, UF, Observações.
- Botões: "Salvar alterações" / "Cancelar" (somente se tocou em algum campo).
- `update` direto na tabela `clients` via supabase client (já tem RLS authenticated all).
- Toast de sucesso/erro.

### 2. `src/components/orcamentos-v2/ClientLastSalesPanel.tsx`
- Props: `clientId: string`
- Busca os últimos 10 registros de `quotes` onde `client_id = clientId`, ordenados por `created_at desc`.
- Colunas: Nº Orçamento, Produto/Descrição, Data, Valor total (`final_total` ou `total`), Status (badge), Ação (link "abrir" → `/orcamentos-v2/:id` em nova aba).
- Estado vazio: "Nenhuma venda registrada para este cliente."
- Skeleton durante loading.

## Mudanças em `NewQuoteFormV2.tsx`

Após o `<ClientCombobox />` (linha ~740), quando `clientId` estiver definido:

```tsx
{clientId && (
  <div className="md:col-span-2 -mt-1 space-y-2">
    <div className="flex items-center gap-4 text-sm">
      <button type="button" onClick={() => setShowClientData(v => !v)}
        className="text-primary hover:underline flex items-center gap-1">
        <UserIcon className="h-3.5 w-3.5" />
        {showClientData ? "Ocultar dados do cliente" : "Dados do cliente"}
      </button>
      <button type="button" onClick={() => setShowLastSales(v => !v)}
        className="text-primary hover:underline flex items-center gap-1">
        <HistoryIcon className="h-3.5 w-3.5" />
        {showLastSales ? "Ocultar últimas vendas" : "Últimas vendas"}
      </button>
    </div>
    {showClientData && <ClientDetailsPanel clientId={clientId} />}
    {showLastSales && <ClientLastSalesPanel clientId={clientId} />}
  </div>
)}
```

Estado adicionado ao componente: `showClientData`, `showLastSales` (booleans, default false). Resetar ambos para `false` quando `clientId` mudar (via `useEffect`).

## Detalhes visuais

- Painéis renderizados dentro de `<Card className="bg-muted/30 border-dashed">` com transição suave (`animate-in fade-in slide-in-from-top-2`).
- Layout responsivo igual ao restante do form (grid 2 colunas em md+).
- Chip "Trocar" do ClientCombobox continua funcionando — ao trocar de cliente, painéis fecham automaticamente.

## Não-objetivos

- Não criar dialog/modal — tudo inline conforme o Tiny.
- Não duplicar a lógica do `Cadastros.tsx` completo; só os campos essenciais editáveis.
- Não tocar no V1 (`NewQuoteForm.tsx`) nem em `OrderEditorDialog.tsx` (pode ser feito depois se solicitado).

## Arquivos afetados

- **Novo**: `src/components/orcamentos-v2/ClientDetailsPanel.tsx`
- **Novo**: `src/components/orcamentos-v2/ClientLastSalesPanel.tsx`
- **Editar**: `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (imports + estado + bloco JSX abaixo do ClientCombobox)
