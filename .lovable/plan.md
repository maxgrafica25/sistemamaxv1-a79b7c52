## Objetivo

Remover a aba **Mão-de-obra** do orçamento V3, pelo mesmo motivo da aba Suprimentos: o tempo/processo já entra embutido quando o usuário escolhe os **acabamentos** dos itens de Impressão e CV (o catálogo de acabamentos consome o mesmo `ProcessPicker` por trás). Ter uma aba dedicada gera risco de cobrança duplicada e polui a navegação.

## Mudanças (frontend)

### 1. `src/components/orcamentos-v3/workspace/TabsLayout.tsx`
- Remover entrada `labor` do array `TABS` (e o ícone `Wrench` do import se não for mais usado).
- Restam 3 abas: **Impressão + Acabamentos**, **Com. Visual**, **Terceirizados**.

### 2. `src/components/orcamentos-v3/NewQuoteFormV3.tsx`
- Remover `import { LaborForm }`.
- Remover o bloco `{active === "labor" && <LaborForm .../>}`.
- Remover o atalho `"4": "labor"` do map de teclado. Restam Alt+1 (print), Alt+2 (cv), Alt+3 (third).

### Preservado (não mexer)
- Tipo `V3LaborItem` em `types.ts`, suporte no `UnifiedCart`, em `pricing.ts`, `saveQuoteV3.ts`, `bookletKit.ts`, `productKit.ts` — orçamentos antigos com itens labor continuam exibindo/salvando corretamente.
- `LaborForm.tsx` permanece no repositório (sem rota), pra resgate fácil caso volte como aba opcional.

## Fora de escopo
- Engine de cálculo, schema de banco, lógica de acabamentos.
- Remover/limpar arquivos não referenciados (fica pra um cleanup futuro).

## Validação
- Tela `/orcamentos-v3/novo` mostra **3 abas** (Impressão+Acabamentos, Com. Visual, Terceirizados).
- Atalhos Alt+1/2/3 funcionam; Alt+4 e Alt+5 não fazem nada.
- Abrir um orçamento salvo que contenha item de mão-de-obra: continua aparecendo no carrinho com o resumo correto.
