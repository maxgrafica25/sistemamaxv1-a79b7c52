# Auditoria de Módulos Órfãos e Duplicidades

Varredura de `src/pages`, `src/components`, `src/App.tsx` e `Sidebar.tsx`.

## 1. Páginas órfãs (arquivo existe, sem rota e sem import)

Nenhum import em todo o `src/`. Podem ser **excluídas** com segurança:

| Arquivo | Status | Substituído por |
|---|---|---|
| `src/pages/Index.tsx` | Sem rota, sem import | `Dashboard.tsx` (rota `/`) |
| `src/pages/Clientes.tsx` | Sem rota, sem import | `Cadastros.tsx` (aba Clientes) |
| `src/pages/Fornecedores.tsx` | Sem rota, sem import | `Cadastros.tsx` (aba Fornecedores) |
| `src/pages/Etapas.tsx` | Sem rota, sem import | `ProcessosProducao.tsx` |
| `src/pages/GruposEtapas.tsx` | Sem rota, sem import | `ProcessosProducao.tsx` (a tabela `step_groups` continua viva e agora é usada pelo detalhamento de sub-etapas — só a página foi descontinuada) |
| `src/pages/LeituraImpressoras.tsx` | Sem rota, sem import | aba dentro de `Equipamentos.tsx` |

## 2. Páginas vivas via redirect (intencional, manter)

`App.tsx` mantém redirects para URLs antigas — bom para links salvos:
- `/materias-primas` → `/insumos`
- `/grupos-materiais` → `/insumos?tab=grupos`
- `/kits-produto` → `/insumos?tab=kits`
- `/orcamentos` → `/orcamentos-v2`

Os arquivos `MateriasPrimas.tsx`, `GruposMateriais.tsx`, `KitsProduto.tsx` continuam sendo **renderizados** dentro de `Insumos.tsx` (abas). **Manter.**

## 3. Componentes duplicados

### 3.1 `SupplierCombobox` (2 arquivos com mesmo nome)
- `src/components/SupplierCombobox.tsx` — usado em `MateriasPrimas` e `SuprimentosCVTab`
- `src/components/equipamentos/SupplierCombobox.tsx` — usado só em `RegisterPurchaseDialog`

Provavelmente um fork antigo. Vale comparar e unificar no global.

### 3.2 Orçamentos V2 × V3
- V2 (`/orcamentos-v2`): lista, edição, clonagem — fluxo principal.
- V3 (`/orcamentos-v3/novo`): só criação, acessível por um botão em `OrcamentosV2.tsx:382`.
- Não é duplicidade propriamente — V3 é o novo fluxo de criação convivendo com V2. **Não mexer** sem decisão de produto.

## 4. Função que perdeu utilidade após mudanças recentes

- **Página `GruposEtapas.tsx`**: foi removida do menu, mas a tabela `step_groups` voltou a ter uso real agora que o detalhamento de sub-etapas no orçamento foi implementado. Hoje o cadastro/edição é feito dentro de `ProcessosProducao.tsx`. A página solta virou código morto — pode remover sem perda funcional.

## 5. Ações propostas (somente quando aprovado)

**Fase 1 — limpeza segura (apenas deleção de arquivos órfãos):**
- Excluir `src/pages/Index.tsx`, `Clientes.tsx`, `Fornecedores.tsx`, `Etapas.tsx`, `GruposEtapas.tsx`, `LeituraImpressoras.tsx`.

**Fase 2 — unificar duplicidade:**
- Migrar `RegisterPurchaseDialog.tsx` para usar `@/components/SupplierCombobox` e excluir `src/components/equipamentos/SupplierCombobox.tsx`. Requer comparar props/UX antes.

**Fora de escopo desta auditoria:** decisão V2 vs V3 (precisa de você).

## Detalhes técnicos

Critério usado:
- "Sem rota": não aparece em `<Route path>` do `App.tsx`.
- "Sem import": `rg "pages/<Nome>" src/` retornou vazio.
- Tabelas e migrations não foram tocadas; apenas código de UI.

## Próximo passo

Me confirme se quer que eu execute a **Fase 1** (6 deleções), a **Fase 2** (unificar SupplierCombobox), ambas, ou nenhuma.
