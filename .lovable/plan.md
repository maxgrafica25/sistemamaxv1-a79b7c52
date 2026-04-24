## Refinamentos aprovados — pronto para implementação

Aplicar 4 mudanças em `src/pages/Equipamentos.tsx` (não há `EquipamentoCards.tsx` separado — os cards estão inline dentro de `Equipamentos.tsx`, por isso só esse arquivo será editado).

### 1. Banner de alerta acima da tabela

Adicionar logo no início da aba "Consumíveis" (só para impressoras não-ribbon):

```text
💡 Orçamentos baseados no Custo de Produção (20% de cobertura).
   O rendimento cadastrado segue o padrão do fabricante (5%).
```

Estilo: `border border-border/60 bg-muted/40`, texto `text-xs text-muted-foreground`, termo "Custo de Produção (20% de cobertura)" em **negrito** com `text-foreground`.

### 2. Linha-resumo dupla (substitui a atual "Custo/página (5%)")

```text
10 consumíveis    Fabricante (5%): R$ 0,1992    Produção (20%): R$ 0,7968
                  ↑ opacity-70                  ↑ text-primary (destacado)
```

### 3. Renomeação e estilização dos 4 cards

Atualizar o array `scenarios` (linhas ~590-600):

| Card atual | Novo label | Nova legenda | Estilo |
|---|---|---|---|
| Color • 5% | **FABRICANTE • COLOR** | Referência teórica | `opacity-60`, borda neutra |
| Color • 20% | **PRODUÇÃO • COLOR** | Valor de orçamento | borda `border-primary`, `shadow-sm`, badge "Ativo" |
| PB • 5% | **FABRICANTE • PB** | Referência teórica | `opacity-60`, borda neutra |
| PB • 20% | **PRODUÇÃO • PB** | Valor de orçamento | borda `border-primary`, `shadow-sm`, badge "Ativo" |

Adicionar campos no objeto de cada cenário: `isProduction: boolean`, `subtitle: string`. No JSX dos cards, condicionar:
- Se `isProduction`: classe `border-primary/60 shadow-sm` + `<Badge variant="default" className="text-[9px] h-4">Ativo</Badge>` no canto
- Se não: classe `opacity-60`

### 4. Tooltip no campo Rendimento (dialog de cadastro)

No dialog (linha ~762), substituir o `<Label>` por um label com ícone `HelpCircle` e tooltip:

> "Informe o valor que consta na embalagem (cobertura 5%). O sistema converterá automaticamente para 20% nos cálculos de venda."

Importar `HelpCircle` de `lucide-react` e os componentes `Tooltip, TooltipContent, TooltipProvider, TooltipTrigger` de `@/components/ui/tooltip`. Aplicar só quando `!isRibbon` (ribbon não usa cobertura).

### 5. Tabela de consumíveis — destaque do total real

A tabela mantém a coluna "Custo/Página" baseada no rendimento do fabricante (útil pra conferir nota fiscal). No rodapé `<TableRow>` "TOTAL" (linha ~523-530), adicionar **uma segunda linha de total destacada**:

```text
┌──────────────────────────────────────────────────────────────┐
│ TOTAL (Fabricante 5%)                          R$ 0,1992 100%│  ← linha existente, atenuada
│ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│
│ TOTAL DE PRODUÇÃO (20%) — usado nos orçamentos  R$ 0,7968    │  ← nova linha, destacada
└──────────────────────────────────────────────────────────────┘
```

Estilo da nova linha: `bg-primary/5 border-t-2 border-primary/30`, fonte `font-bold text-primary`.

## Arquivo afetado

- `src/pages/Equipamentos.tsx` (único arquivo)

## Sem mudanças

- Banco de dados (nenhuma migração)
- Lógica de cálculo de orçamentos (já está correta usando 20%)
- Demais abas e componentes

**Pronto pra implementar — basta sair do modo de planejamento.**