

# Validação de duplicatas no merge + remover "Atualizar todos"

## 1) Validação anti-duplicata ao fundir categorias

Em `src/components/monitoramento/GerenciarCategoriasDialog.tsx`, antes de executar o `UPDATE` em `handleMove` e no ramo `move` de `handleDelete`, rodar uma checagem que detecta colisões `(fornecedor_nome, nome_produto)` entre os sites da **origem** e os já existentes na **destino**.

### Helper `detectDuplicates(origem, destino)`

```ts
const { data, error } = await supabase
  .from("sites_monitorados")
  .select("id, fornecedor_nome, nome_produto, categoria")
  .in("categoria", [origem, destino]);
```

Agrupa por chave normalizada `${(fornecedor_nome||"").toLowerCase().trim()}|${(nome_produto||"").toLowerCase().trim()}` e retorna os grupos onde aparece **pelo menos 1 site da origem + 1 da destino** (ou >1 da origem caindo na mesma chave da destino). Cada item: `{ fornecedor, produto, sitesOrigem: [...], sitesDestino: [...] }`.

### UI: novo dialog `ConfirmarMergeDuplicatasDialog` (inline no mesmo arquivo)

Quando `detectDuplicates` retorna `length > 0`, abre um dialog **antes** do update real:

```
⚠️ Possíveis duplicatas detectadas

Ao mover sites para "{destino}", os seguintes pares fornecedor/produto
ficarão duplicados no comparativo:

• Atual Card — Flyer 14x10 cm 4x4
    └ origem ({origem}): 1 site
    └ destino ({destino}): 1 site

• Gráfica Brasil — Cartão Visita 9x5
    └ origem ({origem}): 2 sites
    └ destino ({destino}): 1 site

[ Cancelar ]   [ Mover mesmo assim ]
```

- "Cancelar" fecha sem alterar nada.
- "Mover mesmo assim" prossegue com o `UPDATE` original e mostra um toast informativo: `"X sites movidos · Y duplicatas criadas — revise no Comparativo"`.
- Se `detectDuplicates` retornar vazio, o fluxo segue direto sem abrir esse dialog (comportamento atual).

Mesmo helper é reutilizado nos dois pontos:
- `handleMove(origem)` (botão "Mover" na lista)
- `handleDelete()` ramo `deleteMode === "move"` (escolha "Mover sites para outra categoria" no dialog de exclusão)

Renomear (`handleRename`) **não** precisa dessa validação — só altera o nome da categoria, não funde com nada.

## 2) Remover "Atualizar todos"

Em `src/pages/Monitoramento.tsx`:

- Remover o `<Button>` "Atualizar todos" (linhas ~663-666) e o ícone `RefreshCw` do header se não for mais usado em outro lugar (manter import se ainda for referenciado em botões individuais por linha).
- Remover a função `handleSyncAll` (linhas ~606-626) e o estado `syncing` / `setSyncing` se não forem usados em outro ponto.
- **Manter** `syncSite()` e o botão de sync individual por linha (útil para forçar atualização manual de um site específico que o usuário acabou de cadastrar, sem esperar o cron diário das 03:00 BRT).
- Atualizar o texto do indicador de status para reforçar a automação:
  ```
  "Sincronização automática diária · Última sync: há 4 horas"
  ```
  (quando `lastSync` existe). Quando não existe: `"Sincronização automática diária às 03:00 — aguardando primeira execução"`.

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/monitoramento/GerenciarCategoriasDialog.tsx` (helper `detectDuplicates` + dialog de confirmação reutilizado em `handleMove` e `handleDelete` ramo move) |
| Editar | `src/pages/Monitoramento.tsx` (remover botão "Atualizar todos", `handleSyncAll`, estado `syncing`; ajustar texto do status para refletir cron automático) |

## Resultado esperado

- Tentar fundir "panfletos" → "panfleto" quando ambos têm "Atual Card · Flyer 14x10": dialog amarelo lista a colisão e pede confirmação explícita.
- Header do Monitoramento mais limpo, sem botão redundante; usuários ainda podem forçar sync de um site individual via o ícone de cada linha.

