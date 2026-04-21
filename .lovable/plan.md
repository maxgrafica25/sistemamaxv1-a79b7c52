

# Polir UX do "Cadastrar novo produto" no ProductPicker

## Problemas

1. Botão roxo gigante (`variant="default"`, `w-full`) dentro do popover — visualmente agressivo e desproporcional.
2. Quando não há texto digitado, dispara `window.prompt()` nativo do navegador — UI feia, fora do tema, intrusivo.

## Solução

### 1. Botão "Cadastrar" mais discreto

No `ProductPicker.tsx`, trocar o bloco do botão por um item compacto, alinhado ao estilo do resto do Command:
- `variant="ghost"` em vez de `default` (sem fundo roxo).
- Texto menor, ícone `+` discreto à esquerda.
- Quando não há busca digitada: rotular **"Digite um nome para cadastrar"** e deixar o botão **desabilitado** (em vez de abrir prompt nativo).
- Quando há busca: rotular **`Cadastrar: "texto"`** e habilitar.

```tsx
<div className="p-1 border-b">
  <Button
    type="button"
    variant="ghost"
    size="sm"
    className="w-full justify-start gap-2 h-8 text-sm font-normal"
    disabled={!trimmedSearch}
    onClick={handleCreateNew}
  >
    <Plus className="h-3.5 w-3.5 text-primary" />
    {trimmedSearch ? (
      <>Cadastrar: <span className="font-medium">"{trimmedSearch}"</span></>
    ) : (
      <span className="text-muted-foreground">Digite um nome acima para cadastrar</span>
    )}
  </Button>
</div>
```

### 2. Eliminar o `window.prompt`

Removido completamente. O fluxo passa a ser: usuário digita no `CommandInput` → o próprio texto vira o nome do novo produto ao clicar em "Cadastrar". Mais rápido, mais limpo, no mesmo controle que ele já está usando para buscar.

### 3. Mensagem do empty state

Ajustar para refletir o novo fluxo: **"Nenhum produto encontrado. Digite o nome desejado e clique em Cadastrar."**

## Fora de escopo

- Lógica de criação no Supabase (`findOrCreateCatalogo`) — intacta.
- `NovoSiteDialog`, demais componentes — intactos.
- Cor primária / tema global.

## Risco

Mínimo. Mudança puramente visual + remoção de `window.prompt`. Sem alterações de schema, RLS ou contrato de `onChange`.

