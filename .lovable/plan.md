## Problema

No diálogo "Novo Kit", quando ainda não há itens, aparecem **dois botões iguais** "Adicionar acabamentos":
1. Dentro do estado vazio (placeholder central com ícone de camadas)
2. Na barra de ações fixa no rodapé

Isso polui a tela e confunde o usuário sobre qual clicar.

## Solução

Manter a barra de ações inferior como **fonte única** dos botões (já contém "Adicionar acabamentos" + "Encadernação espiral"), e simplificar o estado vazio para apenas instrução visual, sem botão.

### Mudança em `src/pages/KitsProduto.tsx` (linhas 707–716)

Remover o `<Button>` interno do empty state. O bloco fica apenas com o ícone + texto apontando para a barra de ações abaixo:

```tsx
<div className="rounded-md border border-dashed py-10 text-center">
  <Layers className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
  <p className="text-sm text-muted-foreground">
    Nenhum item ainda. Use os botões abaixo para adicionar
    acabamentos ou encadernação espiral.
  </p>
</div>
```

Nada mais muda — a barra de ações já tem ambos os botões e o `KitHowItWorks` acima continua explicando o fluxo.

## Fora de escopo

- Mexer no `VariantsDialog`, `AddItemsPicker` ou lógica de itens.
- Reorganizar a barra de ações.
