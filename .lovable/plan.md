## Problema

No modo **Personalizado**, o banner "Parece um Apostila — aplicar preset?" aparece mesmo sem nenhum papel/acabamento selecionado pelo usuário.

## Causa

`PrintForm` recebe `suggestAllFinishings` quando está em Personalizado e **pré-liga todos os acabamentos** como sugestão (incluindo "Espiral", "Wire-o", etc.). Isso dispara `onSelectionChange` com `finishings: [todos]`. O `suggestProduct` casa a regex `wire|espiral` e retorna `apostila`, mesmo com `paper_type = null`.

Ou seja: a sugestão está reagindo a chips que o **sistema** ligou automaticamente, não a escolhas reais do usuário.

## Correção

Travar a sugestão para só rodar quando o usuário tiver feito uma escolha real. Duas guardas pequenas:

1. **`productSuggester.ts`** — exigir `paper_type` preenchido. Se `!input.paper_type`, retornar `null` imediatamente. Nenhuma regra de sugestão faz sentido sem um substrato escolhido.

2. **`PrintAndProductForm.tsx` → `handleSelectionChange`** — guarda extra: se `!sel.paper_type`, fazer `setSuggestion(null)` e sair antes de chamar `suggestProduct`. Garante que mudanças automáticas de chips em modo Personalizado (com papel ainda vazio) nunca produzam banner.

## Fora de escopo

- Manter o comportamento de pré-ligar acabamentos como sugestão visual (é útil quando o usuário escolhe um papel depois).
- Não mexer no preset Crachá nem nas demais regras de `suggestProduct`.
- Nenhuma mudança de UI/visual além de o banner deixar de aparecer indevidamente.

## Arquivos

- `src/components/orcamentos-v3/shared/productSuggester.ts`
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
