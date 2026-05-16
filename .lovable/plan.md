## Ajustes na Calculadora CV

**Mudanças em `src/components/cv-calc/CalculadoraTab.tsx`:**

1. **Remover a linha "Valor mínimo"** do bloco de resultado (apenas a exibição — a regra continua aplicada internamente no engine). Também remover o sufixo " (aplicado)" no resumo.

2. **Layout padrão "lateral direita sticky"** (mesmo padrão usado em outras telas de cálculo do sistema):
   - Mudar o grid de `lg:grid-cols-[1fr_380px]` para `lg:grid-cols-2` com `gap-6` (padrão `LabelLayoutCalculator`).
   - Card de Resultado com `lg:sticky lg:top-4 lg:self-start` para acompanhar o scroll no desktop.
   - No mobile continua empilhado (entradas em cima, resumo embaixo).

3. **Esclarecer a natureza do "valor mínimo"** na aba **Configuração** (`src/components/cv-calc/ConfiguracaoTab.tsx`):
   - Atualizar o texto auxiliar do campo para: *"Valor mínimo de venda para peças muito pequenas (ex.: adesivo 10×10 cm). Não aparece para o cliente — é apenas um piso de cálculo."*

**Fora de escopo:**
- Engine (`src/lib/cv-calc/engine.ts`) e testes não mudam.
- `CVItemCard.tsx` (Orçamentos V2) não muda.