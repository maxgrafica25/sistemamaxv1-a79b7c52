## Banner sem medidas pré-preenchidas

**Arquivo:** `src/components/orcamentos-v3/forms/CVForm.tsx`

### Comportamento atual
- `largura_cm` e `altura_cm` iniciam em `100`.
- Quando a mídia é detectada como banner (auto via nome ou toggle "É banner?"), os 100×100 ficam lá, parecendo medida real.
- Presets com `largura_cm` / `altura_cm` continuam aplicando normalmente.

### Mudança
1. No `useEffect` que define `isBanner` automaticamente (linhas 105‑110) e no `onCheckedChange` do switch "É banner?" (linha 461): quando `isBanner` passar a `true` **e** o usuário ainda não digitou medidas customizadas (largura/altura iguais aos defaults de 100, ou zeros), zerar `largura_cm` e `altura_cm` (setar `0`) para o input aparecer vazio.
2. No `applyPreset` (linhas 73‑91): se o preset for banner mas **não** trouxer `largura_cm`/`altura_cm`, também zerar — caso contrário usar os valores do preset (sem mudança).
3. Garantir que o input numérico mostra vazio quando o valor é `0` (verificar o `<Input type="number">` correspondente; se não tratar, exibir string vazia em vez de `0`).
4. O cálculo (`result`) e a auto‑descrição já tratam `largura/altura <= 0` retornando `null`/string vazia, então não geram item nem preview até o usuário preencher.

### Fora de escopo
- Outros formulários (Print/Booklet/Label).
- Lógica de bastão sugerido (continua dependente da largura preenchida).
- Qualquer mudança de preset, banco ou descrição.
