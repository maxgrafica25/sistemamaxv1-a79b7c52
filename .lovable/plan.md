## Problemas identificados

1. **Botão "Adicionar" + faixas desabilitados ao escolher SRA3** — não há registros de papel para o tamanho `SRA3` em `printing_price_items` (só existem A3, A4 e Carta). Sem papel selecionado, `canAdd` fica `false` e a `TierFaixasPanel` fica `disabled`.
2. **Rótulos dos chips** mostram `SRA3 · Ø5cm` — o `Ø` é confundido com "0" e o prefixo é redundante (a folha já é o toggle acima).
3. **Toggles selecionados em laranja**, não roxo (`data-[state=on]:bg-accent` herdado do shadcn padrão).

## Mudanças

### 1. `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx`

- **Toggles Folha e Forma:** adicionar `data-[state=on]:bg-primary data-[state=on]:text-primary-foreground` nos `ToggleGroupItem` para usar o roxo primário quando selecionados.
- **Aviso visível quando não há papel:** quando `folha.printingOptions.length === 0` e `!folha.isLoading`, exibir um alerta visível imediatamente abaixo do toggle de Folha (sem precisar rolar até o fim do formulário), com texto tipo "Nenhum papel adesivo cadastrado para SRA3. Cadastre em **Preço de Impressão**." + link para `/preco-impressao`. Isso explica direto por que o botão está desabilitado.
- **Mensagem do botão Adicionar quando desabilitado:** tooltip/título no `<Button>` com motivo ("Selecione um papel para continuar") via `title={...}`.

### 2. `src/lib/labels/config-storage.ts`

- **`SEED_LABEL_PRESETS.label`:** trocar `"${sheetId} · Ø${cm}cm"` por apenas `"${cm}cm"` (ex.: `"5cm"`, `"3,5cm"`). A folha vem do toggle acima e o `Ø` (lido como zero) sai.
- Bumpar flag de migração: `presetsMigratedV3` → `presetsMigratedV4`, para reseed dos labels nos usuários existentes.

## Fora de escopo

- **Não criar/cadastrar papéis** no banco — é dado do cliente. O aviso visual já guia o usuário até a tela certa.
- Sem mudanças em engine, sheet-pricing, tipos ou outros formulários.
