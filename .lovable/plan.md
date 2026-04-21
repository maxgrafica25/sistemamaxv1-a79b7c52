

# Melhorar legibilidade de nomes longos no ProductPicker

Na imagem, nomes como "Panfletos 10x14cm (A6) - Couchê 90g -..." ficam truncados com `...`, escondendo o que diferencia uma opção da outra (gramatura, acabamento, fornecedor). Não dá pra escolher sem adivinhar.

## Mudanças em `src/components/monitoramento/ProductPicker.tsx`

**1) Permitir quebra de linha em nomes longos (em vez de truncar)**
- Trocar `<span className="flex-1 truncate">` por `<span className="flex-1 break-words leading-snug">` — texto quebra em múltiplas linhas, mostra tudo.
- Item passa a ter `items-start` (em vez de centralizar verticalmente) pra Check + Badge alinharem no topo quando o nome tem 2-3 linhas.
- `Badge` ganha `shrink-0 self-start mt-0.5` pra não comprimir.

**2) Tooltip nativo no item**
- Adicionar `title={p.nome_canonico}` no `CommandItem` — passar o mouse mostra o nome completo (fallback caso ainda quebre em telas mínimas).

**3) Botão "trigger" continua truncando** (intencional — espaço fixo do form), mas ganha `title={triggerLabel}` pra ver o nome completo no hover.

**4) Largura do popover**
- Hoje: `w-[--radix-popover-trigger-width]` (limitado à largura do botão, ~280px na imagem).
- Novo: `w-[--radix-popover-trigger-width] min-w-[420px] max-w-[90vw]` — popover pode crescer pra acomodar nomes longos sem ficar maior que a tela.

## Resultado visual

Antes: `Panfletos 10x14cm (A6) - Couchê 90g -...  [geral]`
Depois (multi-linha): 
```
✓ Panfletos 10x14cm (A6) - Couchê 90g    [geral]
  Brilho 4x4 cores
```

## Fora de escopo

- Não vou mudar o esquema de dados nem adicionar campo "nome curto" — solução visual resolve.
- Não vou refatorar outros pickers (`PrintingItemSearch`, `MaterialCatalogSearch`) — pedido foi específico do catálogo de monitoramento. Se quiser aplicar lá também, é one-liner adicional.

