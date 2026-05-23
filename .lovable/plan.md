## Reordenar abas + sugerir Processos/Suprimentos pelo nome do kit

### Mudanças no `AddItemsPicker`

1. **Inverter ordem das abas**: **Processos** vira a primeira (aba padrão), **Suprimentos** vira a segunda.
2. **Sugestões automáticas baseadas no nome do kit**:
   - Passar nova prop `kitName: string` para o picker (vindo do estado `name` de `KitsProduto.tsx`).
   - Reutilizar o helper `suggestPresets`-style: normalização (lowercase, sem acento, sem pontuação) + tokens >3 letras + match "contém / contido / token compartilhado".
   - Aplicar a heurística sobre `supplies[].produto` e `processes[].description`.
   - Só roda quando `kitName` tem ≥3 caracteres **e** o usuário não digitou nada no campo "Buscar…" (a busca tem prioridade).
3. **UI da sugestão (no topo de cada aba)**:
   - Faixa destacada `bg-primary/5 border-l-2 border-l-primary` com header pequeno:
     > ✨ Sugestões para "Nome do kit" · [Marcar todos] [Limpar]
   - Lista das linhas sugeridas, idênticas às linhas normais (checkbox + título + subtítulo).
   - **Pré-marca** automaticamente os itens sugeridos quando o picker abre (apenas na 1ª abertura por nome; se o usuário desmarcar, respeita a escolha).
   - As linhas sugeridas **somem da lista principal abaixo** (pra não repetir).
   - Se o usuário começar a digitar em "Buscar…", a faixa some.
4. **Reset de estado**: ao fechar o picker, manter o comportamento atual (resetar seleção); ao reabrir com mesmo nome, sugestões voltam pré-marcadas.

### Por que não usar LLM

Match por nome é um problema clássico de comparação de strings: heurística local responde em <1ms, é grátis e determinística. LLM seria mais lento, custoso e sem ganho real para este caso.

### Detalhes técnicos

- Arquivos:
  - `src/components/kits/AddItemsPicker.tsx`:
    - Nova prop `kitName?: string`.
    - Extrair helper local `matchesKitName(name, kitName)` (mesma fórmula do `suggestPresets`).
    - `useMemo`s para `suggestedSupplies` e `suggestedProcesses`.
    - `useEffect` que pré-marca as sugestões ao abrir (controlado por uma flag `autoMarkedFor: string | null` pra não repetir).
    - Trocar a ordem dos `TabsTrigger` e o `defaultValue` do `Tabs`.
    - `filteredSup`/`filteredProc` excluem ids já presentes em `suggested*` quando a faixa estiver visível.
  - `src/pages/KitsProduto.tsx`:
    - Passar `kitName={name}` ao `<AddItemsPicker />`.

### Fora do escopo

- Sugestão semântica via LLM.
- Aprender com histórico de kits anteriores.
- Mudar a ordem das colunas de itens no kit (já tratado pelo drag).
