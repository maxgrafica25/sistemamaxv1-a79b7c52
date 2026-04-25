## Diagnóstico do fluxo atual

Para a ação mais frequente (leitura diária), são **6 cliques + 2 digitações**. O dialog mistura 2 contextos (leitura rotineira vs. troca de peça) e mostra campos raramente usados em primeiro plano.

## Proposta: 3 melhorias combinadas

### 1. Separar visualmente as 2 ações (botões distintos)

```text
[ + Leitura Rápida ]   [ 🔧 Troca de Toner/Peça ]
```

- **Leitura Rápida** abre dialog mínimo: só Cores + Preto (Total automático)
- **Troca de Toner/Peça** abre dialog dedicado com seleção visual de consumível

**Resultado:** ação mais comum cai de 6 para 4 cliques.

### 2. Dialog "Leitura Rápida" enxuto

```text
┌─ Leitura Rápida — Xerox C70 ───────────────┐
│ Operador: Juliano · 25/04/2026 14:30        │
│                                              │
│  Última leitura (24/04 17:00):               │
│  Cores: 332.816  ·  Preto: 97.145            │
│                                              │
│  Cores            Preto                      │
│  ┌──────────┐    ┌──────────┐               │
│  │ 332.966  │    │  97.245  │               │
│  └──────────┘    └──────────┘               │
│   ↑ +150 hoje    ↑ +100 hoje                │
│                                              │
│  Total: 430.211 (auto)  · +250 desde ontem  │
│                                              │
│  ▸ Adicionar observação                      │
│                                              │
│         [ Cancelar ]  [ ✨ Registrar ]       │
└──────────────────────────────────────────────┘
```

**4 camadas de prevenção de erro:**

1. **Referência visível** acima dos campos
2. **Delta colorido em tempo real** abaixo de cada input
3. **Alerta de outlier**: se delta > 2.000, ícone ⚠️ ao lado mesmo sendo positivo (pega "1500 em vez de 150")
4. **Bloqueio no submit** (já existe)

**Feedback positivo (Enter Inteligente):**
- Botão Registrar fica neutro/desabilitado enquanto `totalDelta <= 0`
- Quando `totalDelta > 0`: ganha cor primária + `ring-2 ring-primary/40` + ícone Sparkles
- Sinal visual: "a conta fechou, pode clicar"

Comportamento dos inputs:
- Pré-preenchidos com a última leitura
- Auto-foco no Cores ao abrir, com texto selecionado
- Tab natural Cores → Preto → Registrar
- Enter no Preto = registrar (se delta > 0)

### 3. Dialog "Troca de Toner/Peça" com seleção visual

```text
┌─ Troca de Toner/Peça — Xerox C70 ──────┐
│ Qual peça foi trocada?                  │
│                                         │
│  [🟦 Ciano] [🟪 Magenta] [🟨 Amarelo]   │
│  [⬛ Preto]  [⚙️ Outra peça]             │
│                                         │
│  Última leitura (24/04 17:00):          │
│  Cores: 332.816 · Preto: 97.145         │
│                                         │
│  Contadores no momento da troca:        │
│  Cores: [332.816]   Preto: [97.145]     │
│                                         │
│  Observações (recomendado):             │
│  [_______________________________]      │
│                                         │
│         [ Cancelar ]  [ Registrar ]     │
└─────────────────────────────────────────┘
```

- 1 clique no chip = consumível selecionado (sem dropdown)
- Mesmas referências de última leitura e deltas do dialog rápido
- Observações em destaque

## O que NÃO muda

- Estrutura do banco (`printer_readings` continua igual)
- Validações server-side existentes
- Histórico/tabela abaixo
- Fluxo PB e Fargo (other) — adaptam o mesmo padrão

## Detalhes técnicos

Arquivo: `src/components/equipamentos/PrinterReadingsTab.tsx`

1. Substituir botão único por dois botões; estado separado: `showQuickDialog` e `showTonerDialog`
2. Extrair 2 sub-componentes internos: `<QuickReadingDialog>` e `<TonerChangeDialog>`

3. **Performance — `useMemo` disciplinado (crítico para escalar):**
   - `lastReading = useMemo(() => readings[0] ?? null, [readings])`
   - `lastColor`, `lastBw`, `lastTotal` extraídos de `lastReading` (primitivos estáveis)
   - `colorDelta = useMemo(() => (parseInt(colorPrints) || 0) - lastColor, [colorPrints, lastColor])`
   - `bwDelta`, `computedTotal`, `totalDelta` análogos
   - `canSubmit = useMemo(() => totalDelta > 0, [totalDelta])`
   - Formatadores e constantes (`TONER_COLORS`, `OUTLIER_THRESHOLD = 2000`) ficam fora do componente

4. **Pré-preenchimento + auto-foco com `requestAnimationFrame`:**
   ```tsx
   useEffect(() => {
     if (!open || !lastReading) return;
     setColorPrints(String(lastReading.color_prints ?? ""));
     setBwPrints(String(lastReading.bw_prints ?? ""));
     // Radix Dialog tem animação de entrada (~150ms). Chamar .select()
     // imediato falha porque o input ainda não recebeu foco real do Radix.
     // requestAnimationFrame espera o próximo frame, garantindo que o
     // DOM esteja pronto e o foco persista. Não usar autoFocus do Radix
     // porque ele foca mas NÃO seleciona o texto.
     requestAnimationFrame(() => inputRef.current?.select());
   }, [open, lastReading]);
   ```

5. **Bloco de referência:**
   ```tsx
   <div className="text-xs text-muted-foreground bg-muted/40 rounded-md px-3 py-2">
     Última leitura ({fmtDate(lastReading.reading_time)}): 
     Cores: <span className="font-mono font-medium">{fmtNum(lastColor)}</span> · 
     Preto: <span className="font-mono font-medium">{fmtNum(lastBw)}</span>
   </div>
   ```

6. **Delta visual com alerta de outlier:**
   ```tsx
   const isOutlier = delta > OUTLIER_THRESHOLD;
   <span className={cn(
     "text-xs flex items-center gap-1",
     delta < 0 ? "text-destructive" : delta === 0 ? "text-muted-foreground" : "text-green-600"
   )}>
     {delta >= 0 ? "+" : ""}{delta.toLocaleString("pt-BR")} hoje
     {isOutlier && <AlertTriangle className="h-3 w-3 text-yellow-500" />}
   </span>
   ```

7. **Botão "Enter Inteligente":**
   ```tsx
   <Button
     onClick={handleSave}
     disabled={!canSubmit}
     className={cn(
       "transition-all",
       canSubmit && "ring-2 ring-primary/40 shadow-md shadow-primary/20"
     )}
   >
     <Sparkles className={cn("h-4 w-4", !canSubmit && "opacity-0")} />
     Registrar
   </Button>
   ```

8. **TonerChange:** mesmas otimizações + chips via `.map(consumables)` com `TONER_COLORS` estático:
   ```ts
   const TONER_COLORS: Record<string, string> = {
     ciano: "bg-cyan-500", cyan: "bg-cyan-500",
     magenta: "bg-fuchsia-500",
     amarelo: "bg-yellow-500", yellow: "bg-yellow-500",
     preto: "bg-zinc-800", black: "bg-zinc-800",
   };
   ```

## Ganho esperado

- Leitura diária: **6 → 4 cliques**, 0 decisões cognitivas extras
- **Erros de digitação capturados em 4 níveis** (referência → delta colorido → alerta outlier → bloqueio)
- **Feedback positivo**: botão brilha quando a conta fecha
- Troca de toner: **0 dropdowns**, identificação visual instantânea
- **Performance estável**: memoização garante fluidez com milhares de leituras
- **Foco confiável**: `requestAnimationFrame` resolve o conflito clássico entre animação do Radix e `.select()`
