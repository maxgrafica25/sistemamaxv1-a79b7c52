# Pré-filtrar busca do "Trocar" pelas opções do próprio item

Hoje ao clicar **Trocar** o `SupplySearch` abre vazio e lista todos os suprimentos do cadastro (Bastão, Cordinha, etc). Precisa abrir já filtrado pelo tipo da linha (Capa → capas, Espiral → espirais).

## Mudança

**Arquivo único:** `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` (linhas ~388-398, o bloco do swap).

O `SupplySearch` (`src/components/orcamentos-v2/SupplySearch.tsx`) já aceita a prop `initialLabel`, que semeia o estado interno `search` e é usado no filtro `produto.toLowerCase().includes(search)`. Basta passar uma palavra-chave por tipo de linha:

| Row key | seed |
|---|---|
| `capa` | `"capa"` |
| `contracapa` | `"capa"` |
| `espiral` | `"espiral"` (sem o tamanho, para listar 5/7/9/12mm) |

Implementação:
```tsx
const searchSeed =
  r.key === "espiral" ? "espiral" :
  r.key === "capa" || r.key === "contracapa" ? "capa" :
  "";

<SupplySearch
  initialLabel={searchSeed}
  placeholder={...}
  onSelect={...}
/>
```

Também ajustar o placeholder pra refletir o contexto ("Buscar outra capa...", "Buscar outro espiral..."), o que já está aproximadamente assim hoje.

## Notas

- O usuário pode apagar o seed e buscar qualquer coisa — a UX continua livre.
- Nenhuma mudança em `SupplySearch`, schema, lógica de override ou `bookletKit.ts`.
- Para `contracapa` usar `"capa"` cobre tanto "CAPA PP CAMURCA PRETA" quanto "CAPA PP LINE INCOLOR", o que faz sentido (a maioria das contracapas é uma capa em variação).

## Fora de escopo

- Adicionar categoria/tipo real no schema de `supplies` (seria mais robusto, mas exige migration e re-cadastro). Fica como melhoria futura se o filtro por substring causar ruído.
