## Seleção múltipla + barra de ações (estilo Olist)

Replicar o padrão do print: checkboxes em cada linha, checkbox no cabeçalho para selecionar todos, e uma **barra fixa no rodapé** que aparece quando há itens selecionados, com botão **Excluir orçamentos** e contador.

### O que muda na tela `/orcamentos-v2`

1. **Coluna de checkbox** como primeira coluna da tabela.
   - Checkbox no `<thead>` seleciona/desmarca todos os itens **filtrados** visíveis.
   - Estado intermediário (`indeterminate`) quando alguns estão marcados.
   - Clicar no checkbox **não** abre o orçamento (stopPropagation).

2. **Barra de ações flutuante** (aparece só quando `selecionados.length > 0`):
   - Posição: `fixed bottom-4 left-1/2 -translate-x-1/2`, com sombra e fundo do tema.
   - Conteúdo:
     - `↑ XX selecionados`
     - Botão vermelho **"Excluir orçamentos"** (ícone `Trash2`)
     - Botão **"Limpar seleção"**
     - À direita: total de valor somado dos selecionados (ex: `R$ 1.932,00`)

3. **Fluxo de exclusão**:
   - Clica em "Excluir orçamentos" → abre `ConfirmDialog` (já existe no projeto).
   - Texto: *"Excluir N orçamento(s)? Esta ação não pode ser desfeita e removerá também itens, etapas e histórico de visualizações vinculados."*
   - Confirmar → executa exclusão em lote, mostra toast, limpa seleção, recarrega lista.

### Regras de segurança

- **Apenas admins** podem excluir (consistente com `create_quote_version`). Para não-admins a barra mostra o contador mas o botão de excluir fica oculto.
- **Bloquear na UI** orçamentos com `is_locked = true` (têm versão mais nova) — checkbox desabilitado com tooltip "Travado: possui versão mais recente".
- **Bloquear** se for `parent_quote_id` de outro orçamento existente (preservar cadeia de versões). Validado no backend pela função.

### Backend (migration)

Criar função SQL `delete_quotes_bulk(p_ids uuid[])`:
- Verifica `is_profile_admin(auth.uid())` — senão `RAISE EXCEPTION`.
- Para cada id: rejeita se `is_locked` ou se for parent de outro quote.
- Deleta em ordem: `quote_engagement_events`, `quote_materials`, `quote_labor_steps`, `quote_third_party`, `quotes`.
- Registra em `audit_logs` (action='delete_quote', entity_id, details=número).
- Retorna `{ deleted_count, skipped: [{id, reason}] }`.

Vantagem da função vs delete direto: garante atomicidade, valida regras e audita em um lugar só.

### Detalhes técnicos

**Estado em `OrcamentosV2.tsx`:**
```ts
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const selectedQuotes = quotes.filter(q => selectedIds.has(q.id));
const selectedTotal = selectedQuotes.reduce((s, q) => s + q.value, 0);
```

**Componentes usados (já existem):**
- `@/components/ui/checkbox` (Checkbox do shadcn)
- `@/components/ConfirmDialog`
- `sonner` toast

**Novos arquivos:**
- `src/components/orcamentos-v2/BulkActionBar.tsx` — barra flutuante reutilizável
- `supabase/migrations/<timestamp>_delete_quotes_bulk.sql` — função SQL

**Arquivos editados:**
- `src/pages/orcamentos-v2/OrcamentosV2.tsx` — coluna checkbox, estado de seleção, integração da barra

### Layout da barra (referência)

```text
┌─────────────────────────────────────────────────────────┐
│  ↑ 02 selecionados   [🗑 Excluir orçamentos]  [Limpar]  │
│                                    Total: R$ 1.932,00    │
└─────────────────────────────────────────────────────────┘
```

### Fora do escopo (pode vir depois)

- Outras ações em massa do print ("cotar fretes", "alterar marcadores") — só estrutura a barra deixa pronto pra adicionar.
- Soft delete (recuperação) — mantemos hard delete por simplicidade; auditoria em `audit_logs` cobre rastreabilidade.

Aprovando, eu já implemento.