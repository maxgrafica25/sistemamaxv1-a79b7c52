# Polimento de produtividade — Matérias-Primas

Três melhorias na página `src/pages/MateriasPrimas.tsx`. Arquivo único, zero mudanças no banco.

---

## 1. Alinhamento refinado da barra (shrink-0 nos filtros)

O input de busca já tem `flex-1` e o botão `+ Novo` já tem `shrink-0`. Falta blindar os Selects para que nunca encolham quando a busca tiver texto longo.

- Linha 527: `w-[180px]` → `w-[180px] shrink-0` (Select "Ordenar por")
- Linha 538: `w-[200px]` → `w-[200px] shrink-0` (Select "Filtrar finalidade")

Resultado: `[🔍 Buscar...........................] [Filtro ▼] [+ Novo Suprimento]`

---

## 2. Barra Search & Filters sticky no topo

Envolver toda a barra em um wrapper `sticky`. O scroll do app acontece dentro do `<main>` (Layout.tsx), então `sticky top-0` cola a barra no topo do main, **logo abaixo** do header global (que é `sticky z-30`).

- Mudar a `<div className="flex items-center gap-3 mt-5">` (linha 520) para uma estrutura sticky:
```tsx
<div className="sticky top-0 z-20 -mx-8 px-8 py-3 mt-5 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/50">
  <div className="flex items-center gap-3">
    {/* input + selects + botão Novo */}
  </div>
</div>
```

Detalhes:
- `-mx-8 px-8` compensa o `p-8` do container raiz, fazendo a barra ocupar toda a largura quando colada.
- `z-20` < `z-30` do header global, garantindo que o header fique por cima caso haja sobreposição.
- `backdrop-blur` + `bg-background/95` mantém legibilidade quando conteúdo passa por baixo.
- Borda inferior sutil aparece naturalmente quando a barra está colada (visualmente separa do conteúdo).

---

## 3. Botão "Duplicar" em cada linha (Papéis e Suprimentos)

Adicionar dois novos handlers e um botão com ícone `Copy` (Lucide — duas folhas) entre Editar e Excluir.

### Handlers novos

```ts
// Suprimentos
const duplicateMaterial = (m: Material) => {
  setEditingMaterial(null);              // força modo "criar"
  setProduto(`${m.produto} (cópia)`);
  setFinalidade(m.finalidade);
  setQuantidade(String(m.quantidade));
  setValor(String(m.valor));
  setFornecedor(m.fornecedor);
  setContato(m.contato);
  setData(new Date().toISOString().split("T")[0]);
  setIsDialogOpen(true);
};

// Papéis
const duplicatePaper = (p: Paper) => {
  setEditingPaper(null);
  setSelectedExistingPaper(null);        // garante modo "criar novo papel", não "atualizar preço"
  setPaperName(`${p.name} (cópia)`);
  setPaperGrammage(p.grammage || "");
  setPaperSheetQty(String(p.sheet_qty));
  setPaperPackPrice(String(p.pack_price));
  setPaperFreightTotal(String(p.freight_price * p.sheet_qty));
  setPaperFreightDivideBy("1");
  setPaperSupplier(p.supplier || "");
  setPaperContact(p.contact || "");
  setPaperDate(new Date().toISOString().split("T")[0]);
  setIsPaperDialogOpen(true);
};
```

### UI — adicionar entre Editar e Excluir

Importar `Copy` em `lucide-react` e inserir nas duas tabelas:

```tsx
<Button variant="ghost" size="icon" className="h-8 w-8"
  onClick={() => duplicatePaper(paper)} title="Duplicar">
  <Copy className="h-4 w-4" />
</Button>
```

(equivalente para `duplicateMaterial(material)` na tabela de Suprimentos).

### Comportamento

- Modal abre **em modo de criação** (não edição) — salvar gera registro novo.
- Nome vem com sufixo " (cópia)" para deixar claro e evitar duplicar nome idêntico (que viola a regra de integridade do projeto).
- Data preenchida com hoje; usuário só altera o que quiser.

---

## Resumo de impacto

| Item | Arquivo | Linhas | Risco |
|------|---------|--------|-------|
| 1. shrink-0 | MateriasPrimas.tsx | 2 linhas | Zero |
| 2. Sticky bar | MateriasPrimas.tsx | wrapper na linha 520 | Baixo (visual) |
| 3. Duplicar | MateriasPrimas.tsx | 2 handlers + 2 botões + import Copy | Baixo |

Sem migrações, sem novas dependências, sem mudanças em outros arquivos.
