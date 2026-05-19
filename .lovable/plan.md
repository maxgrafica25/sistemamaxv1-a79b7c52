## Objetivo
Tornar o campo **Descrição** do `CVForm` auto-preenchido de forma inteligente conforme as escolhas (mídia, banner, resolução, dimensões, quantidade, acabamentos), **sem travar a edição manual** do usuário.

## Comportamento proposto

### 1. Geração automática
Sempre que mídia + dimensões estiverem definidos, montar uma string no padrão:

```
{Tipo} {NomeMídia} {LxA}cm — {qtd}un · {Resolução curta} · {Acabamentos}
```

Exemplos:
- `Banner Lona Brilho 90x120cm — 1un · Alta resolução · Bastão 105cm, Ilhós`
- `Lona Brilho 200x100cm — 2un · Baixa resolução · Refile`
- `Adesivo Vinil 50x30cm — 10un · Alta resolução`

Regras:
- **Tipo**: "Banner" se `isLona && isBanner`; senão usa o `tipo_midia` capitalizado (Lona, Adesivo, Vinil…).
- **NomeMídia**: nome do catálogo, sem repetir o tipo (ex: se nome já contém "Lona", não duplicar).
- **Dimensões**: inteiros em cm, formato `LxA`.
- **Resolução curta**: heurística no nome — "alta resolução" → "Alta resolução"; "baixa" → "Baixa resolução"; senão usa o nome completo.
- **Acabamentos**: lista por vírgula, omitindo o sufixo técnico de bastão (ex: "Banner (Bastão topo e base até 105cm + ...)" → "Bastão 105cm").

### 2. Edição manual preservada
- Estado novo `descricaoEditada: boolean`.
- Auto-gera enquanto `descricaoEditada === false`.
- Assim que o usuário digita no campo → `descricaoEditada = true` e o auto-update para.
- Botão pequeno **"↻ Regenerar"** ao lado do label (ghost, ícone `RotateCcw`) que volta `descricaoEditada` para `false` e regenera com os valores atuais.
- Ao limpar totalmente o campo, voltar automaticamente ao modo auto.

### 3. UX
- Placeholder muda: `"Gerada automaticamente — edite se quiser"`.
- Após submit (`onAdd`), reset volta para modo auto (já que `setDescricao("")` é chamado).

## Implementação técnica
- Novo helper `buildSmartDescricao(...)` em `src/components/orcamentos-v3/shared/` (arquivo novo `buildCvDescricao.ts`) — função pura, fácil de testar.
- Em `CVForm.tsx`:
  - Adicionar state `descricaoEditada`.
  - `useEffect` que recalcula descrição quando dependências (midia, isBanner, impressao, largura, altura, quantidade, acabIds) mudam e `descricaoEditada === false`.
  - Handler do `Input` marca `descricaoEditada = true` (exceto quando esvazia → volta a false).
  - Botão regenerar ao lado do label `Descrição`.

## Fora do escopo
- PrintForm e demais abas (mesmo padrão pode ser aplicado depois se quiser).
- Persistir preferência do usuário.
- IA/LLM — heurística determinística é suficiente e instantânea.

## Arquivos
- **Novo**: `src/components/orcamentos-v3/shared/buildCvDescricao.ts`
- **Modificado**: `src/components/orcamentos-v3/forms/CVForm.tsx`
