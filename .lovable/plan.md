## Objetivo

Em `/insumos`:
1. Dar **identidade visual própria** para cada aba (Papéis × Suprimentos), inclusive quando inativa — hoje as duas ficam cinza e só mudam quando selecionadas, dificultando o reconhecimento.
2. Adicionar **filtros rápidos** mais úteis em Papéis (hoje só tem busca + ordenação) e melhorar os de Suprimentos, sempre como chips visíveis (1 clique).

---

## 1. Cores diferentes nas abas

Componente afetado: `src/components/ui/dot-tabs.tsx` (usado em vários módulos — extensão **opcional**, retrocompatível).

- Adicionar campo opcional `accent` em `DotTab`:
  - `"primary"` (padrão atual, roxo)
  - `"emerald"` (verde para Papéis)
  - `"amber"` (âmbar/laranja para Suprimentos)
- Renderização:
  - **Inativa**: bolinha (dot) sempre na cor do accent (saturação reduzida — `bg-{accent}-500/60`), texto continua `muted-foreground`. Isso já comunica "abas diferentes" sem poluir.
  - **Ativa**: dot + texto + border-bottom na cor cheia do accent (`text-emerald-600`, `border-emerald-500`, etc.).
- Tokens via HSL no `tailwind.config.ts` se ainda não existirem (seguir design system; nada de cor hard-coded em componente).

Em `MateriasPrimas.tsx`:
```ts
tabs={[
  { key: "papel", label: "Papéis", accent: "emerald" },
  { key: "suprimento", label: "Suprimentos", accent: "amber" },
]}
```

Resultado: ao olhar a página, o usuário identifica de imediato qual aba é qual, mesmo sem clicar.

---

## 2. Filtros da aba Papéis

Hoje: só busca + Select de ordenação.

Adicionar **chips de categoria** (já existe o campo `category` nos papéis: Comum / Especial / Adesivo) logo abaixo da busca — mesmo padrão visual dos chips de "Gráfica/CV" em Suprimentos:

```
[Todos · N]  [Comum · N]  [Especial · N]  [Adesivo · N]
```

E mais um chip rápido:
```
[Todos formatos]  [Folha cortada]  [Formato grande]
```
(usa `is_cut_size` — útil porque o usuário busca muito por "tem em A4 cortado?").

Mantém:
- Busca por nome/gramatura
- Select "Ordenar por" (Nome / Gramatura / Preço A4 / Data)

Adicionar também ordenação por **Fornecedor** no Select (papéis têm `supplier`).

---

## 3. Filtros da aba Suprimentos

Hoje: chips Todos/Gráfica/CV + Select de finalidade + busca.

Melhorar:
- Manter chips de módulo (já estão bons).
- Trocar Select de "Finalidade" por **chips horizontais com scroll** quando houver ≤ 6 finalidades; manter Select se forem muitas. Reduz clique (1 toque em vez de abrir dropdown).
- Adicionar Select **Fornecedor** (lista derivada dos próprios suprimentos, com "Todos") — pedido recorrente para comparar preços do mesmo fornecedor.

---

## Arquivos a alterar

- `src/components/ui/dot-tabs.tsx` — adicionar prop `accent` opcional.
- `tailwind.config.ts` — garantir tokens `emerald`/`amber` semânticos (HSL) se faltarem.
- `src/pages/MateriasPrimas.tsx` — passar `accent` nas tabs; adicionar estados/chips de categoria e formato para Papéis; adicionar filtro de fornecedor em Suprimentos; converter finalidade em chips quando ≤6.

## Fora do escopo

- Mudar o visual do DotTabs em outras páginas (continuam com `accent` default = primary roxo).
- Refatorar a estrutura do `MateriasPrimas.tsx` (arquivo grande, mas mexer só nas seções de tabs/filtros).
- Filtros em outras telas (Calculadora, Orçamentos) — só Insumos como pedido.

Posso seguir?
