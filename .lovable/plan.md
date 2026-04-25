# Sidebar Slim + Command Palette com Foco Preditivo da Júlia

Pacote completo de upgrade de navegação + integração proativa com os alertas da Júlia.

---

## 1. Novo Sidebar (claro, slim, recolhível)

**Visual (light):**
- Fundo `slate-50`, borda direita 1px `slate-200`. Sem sombras.
- Item inativo: ícone + texto `slate-600`; hover `slate-100`.
- Item ativo: fundo `purple-50`, ícone/texto em roxo da marca (`hsl(270 70% 50%)`), barra vertical 3px à esquerda em roxo.
- Logo "OrçaGráfica" no topo: roxo da marca.

**Tema dark:** fundo `slate-900` suave, item ativo em `purple-950` com texto roxo médio.

**Comportamento desktop:**
- Expandido `w-64` ↔ recolhido `w-16` (só ícones, com Tooltip de 200ms no hover).
- Toggle no rodapé (`PanelLeftClose`/`PanelLeftOpen`).
- Estado em `localStorage["sidebar-collapsed"]`.
- Transição `duration-300 ease-in-out`.

**Mobile (<768px):**
- Off-canvas: hambúrguer no header abre, overlay escuro atrás, fecha automaticamente ao clicar em qualquer link.

---

## 2. Header

- Hambúrguer à esquerda (só mobile).
- Botão **"Buscar..."** discreto ao lado, com `<kbd>Ctrl K</kbd>` à direita. Abre a paleta.
- Sino de notificações + nome do usuário à direita (mantém).

---

## 3. Command Palette (Ctrl+K)

**Ativação:** `Ctrl+K` / `Cmd+K` global, ou clique no botão "Buscar...". `Esc` fecha.

**Visual (glassmorphism):**
- Modal centralizado no topo (margin-top ≈20%), largura ~640px.
- `bg-white/80 backdrop-blur-xl`, borda fina, shadow grande, `z-[9999]`.
- Animação fade + scale-in 200ms. Dark: `bg-slate-900/80`.

**Estrutura (cmdk):** input com fuzzy nativo, navegação 100% por setas + Enter.

### Grupos de comandos (em ordem de prioridade)

```text
🔥 SUGESTÕES DE URGÊNCIA       (só aparece se houver alerta crítico ativo)
   Lançar Leitura — <Equipamento>      [badge: "5 dias atrasada"]
   ... (um por equipamento com alerta crítico não-resolvido)

NAVEGAÇÃO
   Dashboard, Orçamentos, Clientes/Fornecedores, Matérias-Primas,
   Equipamentos, Processos de Produção, Despesas Fixas,
   Preço Impressão, Monitoramento, Catálogo Produtos,
   Chat Interno, Configurações, Auditoria

AÇÕES RÁPIDAS
   Novo Orçamento              → /orcamentos/novo
   Nova Manutenção             → /equipamentos?tab=maintenance&action=new
   Falar com a Júlia           → abre o AssistenteButton

EQUIPAMENTOS
   Leitura — <Nome>            → /equipamentos?action=quick-reading&equipment=<id>
   Toner — <Nome>              → /equipamentos?action=toner-change&equipment=<id>
```

---

## 4. 🔥 Foco Preditivo da Júlia (a "cereja")

**Origem dos dados:** tabela `reading_alerts_sent`.

**Query no abrir da paleta:**
```sql
SELECT ras.equipment_id, ras.days_overdue, e.name
FROM reading_alerts_sent ras
JOIN equipments e ON e.id = ras.equipment_id
WHERE ras.resolved_at IS NULL
  AND ras.severity = 'critical'
ORDER BY ras.days_overdue DESC, ras.alerted_at DESC;
```
Deduplicar por `equipment_id` (pega o pior alerta de cada equipamento).

**Comportamento:**
- Se a query retornar ≥1 resultado → mostra o grupo **"🔥 Sugestões de Urgência"** no topo, antes de qualquer coisa, **antes do usuário digitar**.
- Cada item: `Lançar Leitura — <Nome>` com badge vermelho à direita: `<N> dias atrasada`.
- O **primeiro item desse grupo é pré-selecionado** (highlight) por padrão — basta `Enter` para resolver.
- Click/Enter → navega para `/equipamentos?action=quick-reading&equipment=<id>` → modal de Leitura Rápida abre instantaneamente.
- Quando o operador digita, o cmdk filtra normalmente entre todos os grupos (urgência continua aparecendo se bater com a busca).

**Realtime:** subscribe em `reading_alerts_sent` (canal Postgres Changes) para refrescar a lista de urgências enquanto a paleta estiver aberta — se outro usuário lançar a leitura, o item some sozinho.

**Habilitar realtime na tabela** (migração SQL):
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.reading_alerts_sent;
```

---

## 5. Roteamento (Equipamentos)

Em `src/pages/Equipamentos.tsx`:
- Ler `useSearchParams` para `action` (`quick-reading` | `toner-change` | `new`), `equipment` (id), `tab`.
- Selecionar a aba certa e pré-selecionar o equipamento.
- Abrir o modal correspondente.
- Após abrir, `setSearchParams({}, { replace: true })` para limpar a URL e evitar reabertura no refresh.

---

## 6. Acabamento

- Transições `duration-300 ease-in-out` em sidebar e modal.
- `aria-current="page"` no item ativo, `focus-visible:ring-2 ring-primary` em todos os links.
- Listener global Ctrl+K com `e.preventDefault()`.
- Tooltips do sidebar recolhido com delay 200ms.

---

## Detalhes técnicos

**Arquivos novos:**
- `src/components/Sidebar.tsx` — novo sidebar claro/slim com toggle e off-canvas mobile.
- `src/components/CommandPalette.tsx` — paleta com grupos dinâmicos, query de urgências e realtime.
- `src/hooks/useSidebarState.tsx` — estado expandido/recolhido + persistência localStorage + open mobile.
- `src/hooks/useCommandPalette.tsx` — open/setOpen + listener Ctrl+K global.
- `src/hooks/useUrgentAlerts.tsx` — busca + realtime de `reading_alerts_sent` críticos não-resolvidos.

**Arquivos editados:**
- `src/components/Layout.tsx` — substitui `<aside>` cru pelo novo Sidebar, adiciona hambúrguer + botão "Buscar..." no header, monta `<CommandPalette />` global.
- `src/index.css` — atualiza tokens `--sidebar-*` no `:root` (slate-50, purple-50, roxo marca) e `.dark` (slate-900 + purple-950).
- `src/pages/Equipamentos.tsx` — handler de `searchParams` para abrir modais.

**Migração SQL:**
- Habilitar realtime em `reading_alerts_sent` (uma linha de `ALTER PUBLICATION`).

**Bibliotecas:** nenhuma nova — `cmdk`, `@radix-ui/*`, `lucide-react`, supabase-js já existem.

---

## Fluxo do operador (resumo)

1. Operador abre o sistema às 8h da manhã.
2. Aperta `Ctrl+K` pra fazer qualquer coisa.
3. Já vê no topo: **"🔥 Lançar Leitura — Xerox C70 — 5 dias atrasada"** já destacado.
4. `Enter` → modal de leitura abre direto, equipamento já selecionado.
5. Lança o número, salva. O alerta some da paleta na hora (realtime).

**De problema crônico a 2 teclas.**

Aprove pra eu seguir para a implementação.
