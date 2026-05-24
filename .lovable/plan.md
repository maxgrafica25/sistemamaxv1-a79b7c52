# Reforço visual do substrato no PrintForm

Hoje o rótulo do campo de seleção alterna entre "Papel" e "Cartão PVC" conforme o produto, mas o texto é pequeno, uppercase e em cor muted — fácil passar batido. Quero adicionar pistas visuais discretas, sem poluir.

## Mudanças (apenas UI, em `PrintForm.tsx`)

1. **Ícone ao lado do rótulo do Field**
   - "Papel" → ícone `FileText` (lucide).
   - "Cartão PVC" → ícone `CreditCard` (lucide).
   - Ícone `h-3 w-3` em `text-primary`, inline com o `<Label>` (mesma linha, mesmo tamanho que o texto uppercase). Mantém o visual minimalista.

2. **Micro-destaque quando vira "Cartão PVC"** (caso não-padrão)
   - O `<Label>` ganha cor `text-primary` (em vez de `text-muted-foreground`) **somente** quando `substrateLabel !== "Papel"`.
   - Justificativa: papel é o caso default/esperado — não precisa chamar atenção. PVC é a exceção (crachá) e merece destaque sutil.

3. **Pequena animação de entrada ao trocar de substrato**
   - Quando `substrateLabel` muda, aplica `animate-in fade-in slide-in-from-left-1 duration-300` no Field uma vez.
   - Implementado com `key={substrateLabel}` no `<Field>` para forçar remount + animação tailwind já existente no projeto.

4. **Placeholder do search reforça o contexto**
   - Atualmente o `PrintingItemSearch` tem placeholder interno fixo. Vou adicionar prop opcional `placeholder` e passar `Buscar ${substrateLabel.toLowerCase()}…` quando vier.
   - Fora de escopo se ficar complicado: deixa só os itens 1–3.

## Arquivos

- `src/components/orcamentos-v3/forms/PrintForm.tsx` — ajustes no `<Field>` (ícone, cor condicional, key) e no helper `Field` (aceitar `icon` opcional).
- `src/components/orcamentos-v3/shared/PrintingItemSearch.tsx` — prop opcional `placeholder` (item 4).

## Fora de escopo

- Não mexe em lógica de cálculo, dados ou outras telas.
- Não adiciona badge/pill ou banner — manteria minimalismo.
