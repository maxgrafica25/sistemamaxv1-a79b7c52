

# Gerenciar categorias do Monitoramento (renomear / excluir / mover)

Como categoria não é tabela própria — é só a coluna `categoria` em `sites_monitorados` — "deletar categoria" significa **mover ou apagar os sites que a usam**. Adicionar um gerenciador dedicado na aba Comparativo.

## Onde

`src/pages/Monitoramento.tsx` — botão `Gerenciar categorias` ao lado do filtro de categoria, abre um novo dialog `GerenciarCategoriasDialog`.

## Componente novo: `src/components/monitoramento/GerenciarCategoriasDialog.tsx`

Lista todas as categorias distintas com a contagem de sites de cada uma:

```
panfleto       12 sites    [Renomear] [Mover sites para...] [Excluir]
flyer           4 sites    [Renomear] [Mover sites para...] [Excluir]
cartão          7 sites    [Renomear] [Mover sites para...] [Excluir]
```

### Ações por linha

1. **Renomear** — input inline + Salvar.
   - `UPDATE sites_monitorados SET categoria = :nova WHERE categoria = :antiga`
   - Faz `.toLowerCase().trim()` na entrada. Bloqueia se a nova categoria for vazia ou idêntica à atual.

2. **Mover sites para…** — `Select` com as outras categorias existentes.
   - `UPDATE sites_monitorados SET categoria = :destino WHERE categoria = :origem`
   - Útil para fundir duplicatas tipo "panfleto" + "panfletos".

3. **Excluir** — abre `ConfirmDialog` com 2 opções:
   - **Mover para outra categoria** (Select obrigatório) → mesmo update do item 2.
   - **Excluir todos os N sites desta categoria** (destrutivo, em vermelho) → `DELETE FROM sites_monitorados WHERE categoria = :alvo` (cascade já remove `site_precos_tiers`, `historico_precos`, `alertas_precos` via FKs existentes; se não houver FK cascade, fazer DELETE explícito antes nos filhos).
   - Texto: "Esta ação não pode ser desfeita. X sites e seus históricos serão removidos permanentemente."

### Após qualquer ação

- Toast de sucesso com resumo (`"Categoria renomeada · 12 sites atualizados"`).
- Refetch de `sites_monitorados` em `Monitoramento.tsx` (já existe `loadSites()`).
- Se a categoria atualmente filtrada deixou de existir, resetar `categoriaFiltro` para "all".

## Permissão

Apenas admins (`is_profile_admin(auth.uid())`) podem acessar o botão "Gerenciar categorias" e, dentro do dialog, apenas admins veem o botão **Excluir** destrutivo. Renomear/Mover ficam liberados para qualquer usuário autenticado (consistente com as RLS já existentes em `sites_monitorados`).

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/monitoramento/GerenciarCategoriasDialog.tsx` |
| Editar | `src/pages/Monitoramento.tsx` (botão + abrir dialog + refetch + reset de filtro) |

## Resultado

- Renomear: corrige typos sem perder histórico.
- Mover: funde duplicatas ("panfleto" + "panfletos" → "panfleto").
- Excluir: remove a categoria movendo ou apagando os sites associados, com confirmação dupla.
- Categorias vazias somem do dropdown automaticamente — sem necessidade de tabela própria.

