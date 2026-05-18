# Padronização dos botões "Adicionar" no módulo de Comunicação Visual

## Problema
No print enviado, os botões do bloco CV não seguem o padrão visual usado no módulo principal de itens (impressão):

- **"+ Adicionar outra peça"** (rodapé do bloco CV) está com `variant="ghost"` e cor cinza/muted, parecendo um link secundário — diferente do botão **"+ Adicionar"** principal (outline, borda primary, texto primary, com chevron de dropdown).
- **"+ Adicionar"** dentro de Acabamentos (CVItemCard) está com `variant="outline"` neutro, sem a cor primary — diferente do padrão usado no bloco de impressão (header "Acabamentos" com `Sparkles` + primary), e também diferente do "+ Adicionar" principal da tabela.
- **"+ Adicionar peça"** no estado vazio do bloco CV também está outline neutro.

Resultado: três botões com a mesma função ("adicionar algo") aparecem em três estilos diferentes na mesma tela.

## Padrão de referência (já existente)
Botão "+ Adicionar" no `QuoteItemsTable` (linha 503-510):

```tsx
<Button
  variant="outline"
  size="sm"
  className="h-8 gap-1.5 text-primary border-primary/40 hover:bg-primary/5 hover:text-primary font-medium"
>
  <Plus className="h-4 w-4" /> Adicionar
</Button>
```

Este é o padrão "ação primária outline" do módulo. Todos os botões equivalentes devem segui-lo.

## Mudanças

### 1. `NewQuoteFormV2.tsx` — bloco CV

**"Adicionar peça" (estado vazio, ~linha 1718-1727):** aplicar mesmas classes do padrão (`text-primary border-primary/40 hover:bg-primary/5 hover:text-primary font-medium`), trocar label para "Adicionar peça de comunicação visual".

**"Adicionar outra peça" (rodapé, ~linha 1748-1758):** mudar de `variant="ghost" ... text-muted-foreground` para o mesmo padrão outline primary. Manter alinhamento à direita.

### 2. `CVItemCard.tsx` — botão "Adicionar" acabamentos (~linha 341-343)

Aplicar mesmo padrão: `variant="outline"`, classes `h-7 gap-1 text-xs text-primary border-primary/40 hover:bg-primary/5 hover:text-primary font-medium` (mantendo h-7 por estar no header interno do card, mais compacto), adicionar `ChevronDown` opcional já que abre Popover.

### 3. `PrintingItemEditor.tsx` — botão "Adicionar lote de quantidade" (~linha 1075-1083)

Avaliar se também deve seguir o padrão. Atualmente é `variant="ghost"` muito sutil. Sugestão: manter `ghost` mas trocar cor para `text-primary hover:bg-primary/5` para sinalizar ação, já que é um "adicionar secundário" dentro de um sub-bloco (diferente nível hierárquico que o "+ Adicionar" do nível de item). **Confirmar com o usuário** se quer padronizar este também ou manter discreto.

## Arquivos alterados
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx` (2 botões)
- `src/components/orcamentos-v2/CVItemCard.tsx` (1 botão)
- opcional: `src/components/orcamentos-v2/PrintingItemEditor.tsx` (1 botão)

Sem mudança de comportamento, apenas estilo.
