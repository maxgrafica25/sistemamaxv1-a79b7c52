## Refinamentos: Polish, Realtime preciso, A11y e Celebração

Quatro melhorias cirúrgicas no fluxo "Problema Crônico → 2 Teclas".

### 1. Skeleton da Paleta (anti layout-shift)

**`src/components/CommandPalette.tsx`** — Quando `loading=true` da `useUrgentAlerts` e ainda não há cache de `alerts`, renderizar um `CommandGroup heading="🔥 Sugestões de Urgência"` com 1–2 linhas placeholder usando `<Skeleton>` (shadcn) na mesma altura do `CommandItem` real (~36px). Assim o grupo já reserva espaço e não há "pulo" quando os dados chegam.

- Expor `loading` no destructuring: `const { alerts, loading } = useUrgentAlerts(open);`
- Adicionar `aria-hidden` nos skeletons para o leitor de tela ignorar.

### 2. Confete + feedback gratificante na Leitura Rápida

**`src/components/equipamentos/PrinterReadingsTab.tsx`** (linha ~798, após `toast.success("Leitura registrada!")`):

- Detectar se a leitura **resolveu um alerta crítico**: antes do INSERT, verificar se existe linha em `reading_alerts_sent` com `equipment_id` = atual, `severity='critical'`, `resolved_at IS NULL` (rápido — o trigger `resolve_overdue_alerts_on_reading` já cuida do UPDATE). Guardar em `wasOverdue`.
- Se `wasOverdue`, disparar:
  - **Confete** via `canvas-confetti` (lib leve ~3KB, instalar) — burst central de 80 partículas, cores da marca (roxo + laranja-accent), 600ms.
  - **Toast especial**: `toast.success("🎉 Alerta crítico resolvido!", { description: "Júlia agradece. Equipamento de volta ao verde." })` com duração de 4s.
- Se não havia urgência, mantém o toast atual.
- Respeitar `prefers-reduced-motion`: pular confete se `matchMedia('(prefers-reduced-motion: reduce)').matches`.

### 3. Realtime preciso (filtro de payload)

**`src/hooks/useUrgentAlerts.tsx`** — Hoje o handler chama `fetchAlerts()` para qualquer evento (refetch completo). Vamos torná-lo cirúrgico:

- Para `event: 'DELETE'` ou `event: 'UPDATE'` com `new.resolved_at !== null`: remover localmente do estado via `setAlerts(prev => prev.filter(a => a.equipment_id !== payload.new.equipment_id))` — feedback **instantâneo**, sem round-trip.
- Para `event: 'INSERT'` com `severity='critical'` e `resolved_at IS NULL`: ainda chamar `fetchAlerts()` (precisa do JOIN em `equipments.name`).
- Manter `REPLICA IDENTITY DEFAULT` (já está; a migration anterior setou FULL — vou reverter para DEFAULT, suficiente aqui e mais leve).

### 4. Acessibilidade — Announcer

**`src/components/CommandPalette.tsx`**:

- Adicionar uma região `aria-live="polite"` (visualmente oculta com `sr-only`) dentro do `DialogContent` que, quando `urgentAlerts.length > 0` ao abrir, anuncia: `"Alerta crítico encontrado: Lançar leitura para {nome}. Pressione Enter para resolver."`.
- O `cmdk` já marca o item com `aria-selected="true"` via `defaultValue` — confirmado, não precisa mudar.
- Atualizar a `DialogPrimitive.Description` para incluir hint sobre urgências quando aplicável.

### 5. SQL — ajuste do REPLICA IDENTITY

Migration revertendo para o padrão (mais leve, suficiente já que filtramos por `payload.new`):

```sql
ALTER TABLE public.reading_alerts_sent REPLICA IDENTITY DEFAULT;
```
A publicação `supabase_realtime` já inclui a tabela (migration anterior).

### Dependência nova

- `canvas-confetti` (~3KB gzip) + `@types/canvas-confetti` (dev). Sem alternativa nativa equivalente.

### Resultado

- Paleta abre **sem layout-shift** mesmo com a query do Supabase em voo.
- Resolver um alerta de 5+ dias dispara **confete + toast premium** — vira hábito gratificante.
- Itens da urgência somem **instantaneamente** quando resolvidos em outra aba/dispositivo.
- Leitor de tela anuncia urgência ao abrir Ctrl+K.