## Objetivo
No formulário Com. Visual (`CVForm.tsx`), substituir o card fixo "Resolução de impressão · Padrão recomendado · alta qualidade" por **chips/pílulas selecionáveis**, no mesmo estilo dos chips de acabamento, para que o usuário possa trocar livremente entre as resoluções compatíveis (inclusive baixa resolução).

## Mudanças

1. **Remover** o bloco do card destacado com ícone `Sparkles` em `CVForm.tsx`.
2. **Adicionar** um novo `Field label="Resolução de impressão"` logo abaixo do seletor de mídia, renderizando `impressoesCompat` como pílulas (mesmo visual dos chips de acabamento):
   - Ativa: `bg-primary text-primary-foreground border-primary`.
   - Inativa: `bg-background hover:bg-muted border-input`.
   - Single-select (clicar troca o `impressaoId`).
3. **Manter** o auto-select existente: ao trocar de mídia, pré-seleciona "Impressão solvente alta resolução" (ou primeira compatível).
4. **Estado vazio**: se nenhuma impressora for compatível, mostrar texto cinza "Nenhuma resolução compatível disponível". Se nenhuma mídia selecionada, esconder a seção.
5. Remover o import do ícone `Sparkles` se não for mais usado.

## Fora do escopo
- Lógica de cálculo (`engine.ts`).
- PrintForm e demais abas.
- Mudanças no catálogo de impressões.

## Arquivos
- `src/components/orcamentos-v3/forms/CVForm.tsx` (apenas presentation)
