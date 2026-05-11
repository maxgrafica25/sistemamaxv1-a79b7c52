## Diagnóstico

O dropdown de papel para adesivos **já está filtrando corretamente** — só mostra adesivos A4/A3 quando o `productKind` começa com "adesivo"/"etiqueta" (filtro em `PrintingItemEditor.tsx` linha 402–409), e **já pré-seleciona A3** automaticamente (linhas 200–213). No banco só existem 2 entradas: `Adesivo Brilho A3 F` e `Adesivo Brilho A4 F`.

**O bug real é outro**: no print, o campo "Papel" mostra `Adesivo Brilho — 50x50mm F` em vez de `Adesivo Brilho — A3 F`. Isso acontece porque a função `handleDimensionChange` (linha 141–147 de `PrintingItemEditor.tsx`) **sobrescreve** `item.size` (que guarda o tamanho da FOLHA — A3/A4) com o tamanho da PEÇA (`5x5mm`) toda vez que o usuário digita Largura/Altura:

```ts
const nextSize = nextW && nextH ? `${nextW}x${nextH}mm` : item.size ?? null;
onItemChange({ ...patch, size: nextSize });
```

Ou seja: o usuário escolhe `Adesivo Brilho A3` → `item.size = "A3"` ✓. Em seguida digita Largura=5 / Altura=5 → `item.size` vira `"50x50mm"` e a folha se "perde" visualmente. Tamanho de peça já é guardado em `widthMm`/`heightMm` separadamente, então sobrescrever `size` é redundante e quebra a exibição.

Efeitos colaterais:
- O label do papel selecionado fica errado (o que o usuário viu).
- Recálculo de custo pode usar branch errado em `getLivePaperCost` (`size === "A4"` → preço A4, senão SRA3) — para `"50x50mm"` cai no SRA3, possivelmente alterando o custo.
- O `dynamicTitle` também consome `size` e pode ficar com texto estranho.

## Correção

Editar **`src/components/orcamentos-v2/PrintingItemEditor.tsx`**, função `handleDimensionChange` (linha 141–147):

- **Não sobrescrever `item.size` quando já houver papel do catálogo selecionado** (i.e., quando `item.paperType` está definido). O tamanho da folha (A3/A4/SRA3) vem do catálogo e deve ser preservado.
- Manter o fallback de derivar `size` a partir de dimensões **apenas** quando `item.paperType` for `null` (item ainda sem papel do catálogo) — preserva compatibilidade com fluxos legados.

```ts
const handleDimensionChange = (patch: { widthMm?: number; heightMm?: number }) => {
  const nextW = patch.widthMm ?? item.widthMm ?? null;
  const nextH = patch.heightMm ?? item.heightMm ?? null;
  // Se já há papel do catálogo, NUNCA sobrescreve size (que é o tamanho da folha).
  // Caso contrário, mantém comportamento legado de derivar size das dimensões.
  if (item.paperType) {
    onItemChange(patch);
    return;
  }
  const nextSize = nextW && nextH ? `${nextW}x${nextH}mm` : item.size ?? null;
  onItemChange({ ...patch, size: nextSize });
};
```

Sem mudanças no filtro do dropdown nem na lógica de pré-seleção de A3 — ambos já estão corretos.

## Validação esperada

- Abrir um adesivo novo → A3 já vem pré-selecionado (`Adesivo Brilho — A3 F`).
- Digitar Largura/Altura da peça → o campo "Papel" continua mostrando `Adesivo Brilho — A3 F` (não muda mais para `50x50mm`).
- Trocar manualmente para A4 pelo dropdown continua funcionando.
- Custos passam a ser calculados consistentemente com a folha real (A3 → preço SRA3; A4 → preço A4).

## Arquivos tocados

- `src/components/orcamentos-v2/PrintingItemEditor.tsx` (apenas a função `handleDimensionChange`)