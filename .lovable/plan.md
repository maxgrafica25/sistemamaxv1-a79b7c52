## Objetivo

Garantir que **toda ação bloqueada por permissão** (RLS de admin/financeiro/etc.) mostre uma mensagem clara ao usuário, em vez de falhar silenciosamente ou exibir um falso "salvo com sucesso".

Hoje, ações executadas por Colaboradores em telas restritas a Admin (como Preço de Impressão, Equipamentos, Despesas Fixas, Categorias de Materiais, etc.) retornam erro 403 do Supabase, mas o código React ignora o `error` e mostra `toast.success(...)` mesmo assim. Resultado: o usuário pensa que cadastrou, mas o registro nunca foi salvo.

## O que já existe

O projeto já tem o helper `src/lib/handleError.ts` que traduz a mensagem técnica de RLS para "Você não tem permissão para essa ação. Contate um administrador." Porém, está sendo usado em apenas 4 dos ~38 arquivos com mutações.

## Estratégia

Em vez de proteger cada operação individualmente em 38 arquivos (alto custo), vou agir em **3 camadas complementares**:

### Camada 1 — Aprimorar o helper central (`handleError.ts`)

- Refinar a mensagem de RLS para incluir o contexto da ação:
  > "Sem permissão para **cadastrar item de impressão**. Apenas administradores podem fazer essa alteração."
- Detectar também variantes de mensagens de RLS do PostgREST: `"new row violates row-level security"`, `"permission denied"`, `"policy"`.
- Não alterar API pública — continua sendo `handleError(error, "salvar item")`.

### Camada 2 — Helpers de UI preventivos (novo)

Criar `src/lib/permissions.ts` com:

- `useAdminGuard()` — retorna `{ isAdmin, requireAdmin(action: string): boolean }`. Se chamado por não-admin, dispara `toast.error("Apenas administradores podem {action}")` e retorna `false`. Permite bloquear a ação **antes** de chamar o Supabase, melhorando UX.
- Componente `<AdminOnly fallback?>{children}</AdminOnly>` para esconder/desabilitar botões de ação para Colaboradores, deixando claro visualmente que aquilo é restrito (badge "Admin" ou tooltip "Apenas administradores").

### Camada 3 — Aplicar nas páginas/componentes de alta prioridade

Adicionar tratamento de erro nas mutações dos arquivos onde a regra "só admin" se aplica. Identificados pelas RLS do banco que exigem `is_profile_admin`/`has_role('admin')`:

**Páginas administrativas** (todas as mutações):
- `src/pages/PrecoImpressao.tsx` — categorias, regras (tiers), grupos de markup, itens de preço
- `src/pages/Equipamentos.tsx` — equipamentos, consumíveis, manutenções
- `src/pages/MateriasPrimas.tsx` — papéis, suprimentos
- `src/pages/Fornecedores.tsx` / `src/pages/Clientes.tsx` / `src/pages/Cadastros.tsx` (se restritos)
- `src/pages/DespesasFixas.tsx` — despesas, custos
- `src/pages/Acabamentos.tsx`, `src/pages/Etapas.tsx`, `src/pages/GruposEtapas.tsx`, `src/pages/GruposMateriais.tsx`, `src/pages/ProcessosProducao.tsx`
- `src/pages/Usuarios.tsx` — gestão de usuários (já admin-only por natureza)
- `src/pages/Configuracoes.tsx` — configurações da empresa
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — exclusões em massa

**Componentes de dialog/edição** com mutações:
- `src/components/equipamentos/MaintenanceRequestsTab.tsx`, `ProductionLossesTab.tsx`, `PrinterReadingsTab.tsx`, `MaintenanceTab.tsx`
- `src/components/orcamentos-v2/NewQuoteFormV2.tsx`, `GenerateOrderButton.tsx`, `ClientDetailsPanel.tsx`
- `src/components/pedidos/OrderEditorDialog.tsx`
- `src/components/chat/CreateChannelDialog.tsx`, `AddMemberDialog.tsx`, `ChannelDetailsPanel.tsx`
- `src/components/monitoramento/NovoSiteDialog.tsx`, `GerenciarCategoriasDialog.tsx`
- `src/components/configuracoes/CompanyTab.tsx`
- `src/components/CadastroFormDialog.tsx`

Para cada um, o padrão de mudança é mecânico:

```ts
// Antes
await supabase.from("printing_price_items").insert(records);
toast.success("Item criado!");

// Depois
const { error } = await supabase.from("printing_price_items").insert(records);
if (error) return handleError(error, "cadastrar item de impressão");
toast.success("Item criado!");
```

Sem alterar lógica de negócio nem RLS — apenas adicionar a captura `{ error }` e a chamada `handleError(...)`.

### Camada 4 — Esconder/desabilitar botões para Colaboradores (UX preventiva)

Nas telas de gestão restrita, envolver botões "Novo / Editar / Excluir" em `<AdminOnly>` ou desabilitar com tooltip explicativo. Lista de botões a marcar:

- Preço de Impressão: "Nova Categoria", "Nova Regra", "Novo Item", ícones de editar/excluir nas linhas
- Equipamentos: "Novo Equipamento", "Editar", "Excluir"
- Matérias-Primas: "Novo Papel/Suprimento", "Editar", "Excluir"
- Despesas Fixas: idem
- Acabamentos / Grupos / Processos: idem
- Configurações: campos da empresa em modo readonly para não-admins

Assim, em vez de "tentar e falhar", o Colaborador vê de imediato que aquela área é restrita.

## Fora do escopo

- **Não vou alterar nenhuma RLS do banco** — a regra "só admin gerencia preços/cadastros" é intencional.
- **Não vou tocar em lógica de cálculo, formulários, layout** — apenas captura de erro e visibilidade de botões.
- **Tabelas com RLS pública** (que qualquer usuário autenticado pode escrever — ex.: chat messages do próprio user, cliente próprio) ficam como estão, apenas adicionando `handleError` para qualquer erro técnico.

## Validação

Após as mudanças, vou logar como Colaborador no preview e tentar:
1. Cadastrar item em Preço de Impressão → deve mostrar mensagem clara de permissão
2. Editar equipamento → idem
3. Verificar que botões aparecem desabilitados/escondidos em telas admin-only

## Resumo de arquivos a tocar

- 1 arquivo refinado: `src/lib/handleError.ts`
- 2 arquivos novos: `src/lib/permissions.ts`, `src/components/AdminOnly.tsx`
- ~25 páginas/componentes ajustados para chamar `handleError(...)` nas mutações e usar `<AdminOnly>` em botões críticos
