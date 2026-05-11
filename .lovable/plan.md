# Derivar bookletDuplex da Cor da Impressão

## Problema
Hoje o usuário define F/V em três lugares (Cor da Impressão `4x4`/`1x1`, nome do papel e toggle do bloco apostila). O toggle é redundante e propenso a erro: se ele escolhe `4x4` e esquece o toggle, o cálculo de impressões fica errado.

## Solução
Eliminar o toggle. `bookletDuplex` passa a ser **derivado em tempo real** da `printColors`:

| printColors | bookletDuplex |
|-------------|---------------|
| `4x4`, `1x1` | `true` (F/V) |
| `4x0`, `1x0` | `false` (Frente) |
| vazio/desconhecido | fallback `true` (mantém comportamento atual) |

A fonte da verdade é `item.printColors` (campo já existente no topo do editor). O toggle é apagado.

## Mudanças em `PrintingItemEditor.tsx`

1. **Helper local** logo após o cálculo de `isApostila`:
   ```ts
   const duplexFromPrintColors = (pc?: string | null) => {
     if (pc === "4x4" || pc === "1x1") return true;
     if (pc === "4x0" || pc === "1x0") return false;
     return null;
   };
   const bookletDuplex =
     duplexFromPrintColors(item.printColors) ?? item.bookletDuplex ?? true;
   ```
   Substitui a linha 114 atual (`const bookletDuplex = item.bookletDuplex ?? true;`).

2. **Remover o bloco do toggle** (linhas ~662–694): apaga a `<Label>Impressão</Label>` e os botões "Frente / Frente e Verso".

3. **Resumo continua igual** (linhas ~695–710) — já lê `bookletDuplex`, que agora vem derivado de `printColors`. Sem mudança de texto.

4. **Sincronização ao trocar Cor da Impressão**: ajustar `handlePrintColorsChange` (linha 173) para, quando o item for apostila, recalcular `pieces`/`quantity` (a contagem de folhas físicas não muda, mas mantém `bookletDuplex` persistido coerente para casos legados):
   ```ts
   const handlePrintColorsChange = (pc: string) => {
     const side = sideFromPrintColors(pc) ?? item.side ?? null;
     const patch: Partial<Item> = { printColors: pc, side };
     const dup = duplexFromPrintColors(pc);
     if (isApostila && dup !== null) patch.bookletDuplex = dup;
     onItemChange(patch);
   };
   ```

5. **Handlers de folhas/apostilas** (linhas 627–657) permanecem iguais — já não dependem de `bookletDuplex` para o cálculo de `pieces` (folhas físicas).

## Out of scope
- `pricing.ts`, `sheet-yield.ts`, schema, persistência de `booklet_duplex` (campo continua no banco como espelho).
- Outros editores/uso de `bookletDuplex` fora do `PrintingItemEditor.tsx`.

## Arquivo único editado
- `src/components/orcamentos-v2/PrintingItemEditor.tsx`
