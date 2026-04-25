## Manutenções Elite Mode — Pronto para codar

Todas as dependências (`canvas-confetti`, `cmdk`, `@types/canvas-confetti`) já estão instaladas. Realtime de `reading_alerts_sent` já habilitado em migration anterior. **Zero migrações novas.**

---

### Arquivos a criar (3)

**1. `src/hooks/useMaintenanceHotkeys.tsx`** — hotkey global "M" com guard de inputs e detecção de dialog aberto.

**2. `src/components/equipamentos/PartsMultiSelect.tsx`** — Combobox cmdk:
- Carrega `equipment_consumables` (catálogo) + peças usadas em manutenções anteriores deste equipamento (extraídas de `replaced_parts`).
- 3 grupos: "Catálogo do equipamento" (com preço), "Usadas anteriormente", "Personalizada" (Enter cria tag livre).
- Callback `onPriceSuggestion(price, name)` quando o usuário escolhe uma peça do catálogo com preço > 0.
- Tags clicáveis com ícone de remover.

**3. `src/components/equipamentos/MaintenanceTimeline.tsx`** — Lista Collapsible:
- Linha de **48px** (`h-12`): ícone tipo (Shield/Wrench), data DD/MM, técnico, peça principal +N, badge valor, contagem de anexos, chevron.
- **Barra lateral roxa de 3px** aparece somente no item expandido (transição opacity).
- Conteúdo expandido: grid de stats, tags de peças, descrição, observações, galeria de anexos, botões Copiar/Editar/Excluir.
- Empty state com hint do hotkey "M".

### Arquivo a refatorar (1)

**`src/components/equipamentos/MaintenanceTab.tsx`** — refatoração completa:

- **Auto-fill ao abrir nova manutenção:**
  - Query paralela: `printer_readings` (último counter) + `equipment_maintenances` (último technician do equipamento).
  - Estados `suggestedCounter` e `suggestedTechnician` controlam chips `↩ sugerido` que somem quando o campo é alterado.

- **Validação de contador:** se `Number(totalCounter) < suggestedCounter`, mostra alerta vermelho inline ("Atenção: Contador inferior à última leitura registrada (XXX)").

- **Banner de alerta crítico:** ao abrir o dialog, busca `reading_alerts_sent WHERE equipment_id=? AND severity='critical' AND resolved_at IS NULL`. Se existir, renderiza banner amarelo no topo com checkbox "Resolver com esta manutenção" (default ON). Ao salvar com checkbox ativo: `UPDATE reading_alerts_sent SET resolved_at = now()` para todos os alertas críticos abertos do equipamento.

- **Hotkeys:** `useMaintenanceHotkeys({ enabled: !showDialog, onOpenNew: () => openDialog() })`. Dentro do `<DialogContent>`: `onKeyDown` global captura `Ctrl/Cmd+Enter` para chamar `save()`. Esc nativo do Radix.

- **Auto-focus:** `useEffect` no abrir → `technicianRef.current?.focus()`.

- **Botão "↻ Repetir última":** no header da Timeline, busca a última manutenção do equipamento e abre dialog com `technician`, `maintenance_type`, `replaced_parts` clonados.

- **PartsMultiSelect:** substitui o `<Input>` de `replaced_parts`. Internamente armazena `string[]` e serializa como CSV ao salvar (compat retroativa: ao editar, faz split por `,`). Callback `onPriceSuggestion`: se o usuário escolhe peça do catálogo e o campo `cost` ainda está em "0", auto-preenche e mostra toast discreto "💡 Valor sugerido pelo catálogo".

- **Confetti + toast premium:** ao salvar, se `alertResolved === true` OU `(maintenance_type === 'preventiva' && hadCriticalAlert)`:
  ```ts
  confetti({
    particleCount: 80, spread: 70, origin: { y: 0.7 },
    colors: ['hsl(270 70% 60%)', 'hsl(150 60% 50%)', 'hsl(45 90% 60%)']
  });
  toast.success('🎉 Equipamento de volta ao verde!', {
    description: 'Manutenção registrada e alerta crítico resolvido.'
  });
  ```

- **Form compacto:** grid 3 colunas para Contador|Horas|Valor já no mobile (`grid-cols-3`, sem `sm:`). Bordas `border-border/60`, `space-y-3`, labels `text-xs`, inputs `h-9`.

- **URL searchParams:** se a tab foi aberta via link com param tipo `?openMaintenance=1`, limpar com `setSearchParams({})` após abrir o dialog (já há padrão similar em `Equipamentos.tsx` — verificar se aplicável; só adicionar se houver param).

---

### Detalhes técnicos

- **Schema:** zero alterações. Usa colunas existentes em `equipment_maintenances`, `printer_readings`, `reading_alerts_sent`, `equipment_consumables`.
- **RLS:** UPDATE em `reading_alerts_sent` já é permitido a authenticated (verificado nas policies atuais).
- **Realtime:** já configurado anteriormente (`REPLICA IDENTITY DEFAULT` + publicação) — qualquer resolução de alerta dispara o `useUrgentAlerts` automaticamente.
- **Compatibilidade retroativa:** registros antigos com `replaced_parts = "Cilindro, Belt"` (texto livre) continuam abrindo corretamente — o parser CSV do MultiSelect aceita qualquer string.
- **Acessibilidade:** hotkey "M" só dispara fora de campos editáveis e quando nenhum dialog está aberto. Dialog mantém trap de foco do Radix.

Pronto para mudar para modo build e aplicar.
