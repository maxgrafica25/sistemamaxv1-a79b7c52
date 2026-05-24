## Objetivo

Simplificar o cadastro de acabamentos gráficos: todo acabamento passa a ser "Por unidade" por padrão, com um toggle opcional que ativa o multiplicador automático de formato (A3/SRA3 = 2x, F/V = 2x) — usado hoje em laminação/plastificação e disponível para qualquer acabamento no futuro. UX com explicações inline para evitar confusão.

## Modelo conceitual (3 modos)

```text
┌─────────────────────────────────────────────────────────────┐
│ Modo de cobrança                                            │
├─────────────────────────────────────────────────────────────┤
│ ○ Por unidade                                               │
│   Cobra o preço cheio por folha/peça processada.            │
│   Use para: ilhós, dobra, vinco, furo, refile, wire-o…      │
│                                                             │
│ ○ Por unidade com multiplicador de formato                  │
│   Cobra o preço base e multiplica conforme o formato        │
│   da folha e impressão F/V. Configurável global.            │
│   Use para: laminação, plastificação, verniz, hot stamping… │
│   ┌─────────────────────────────────────────────────────┐  │
│   │ Multiplicadores ativos:                             │  │
│   │   A4: 1x  •  A3/SRA3: 2x  •  Frente e verso: 2x    │  │
│   │   (stack até 4x — ex: SRA3 F/V = 4x)               │  │
│   └─────────────────────────────────────────────────────┘  │
│                                                             │
│ ○ Somente tempo (sem cobrança)                              │
│   Não soma valor no orçamento — apenas registra os          │
│   minutos de mão de obra para cálculo de tempo de           │
│   produção. Use para: conferência, embalagem, controle…     │
└─────────────────────────────────────────────────────────────┘
```

## Migração de dados

Coluna nova `auto_format_multiplier boolean default false` em `finishings_price_items`. Backfill:

- Quem hoje tem `pricing_model = 'per_sheet'` → `auto_format_multiplier = true`.
- Quem hoje tem `pricing_model = 'per_unit'` → `auto_format_multiplier = false`.
- `pricing_model` permanece na tabela como legado (não removemos agora — código novo lê só o flag).

Resultado: nenhum preço muda; comportamento idêntico ao atual no primeiro deploy.

## Mudanças por arquivo

### Banco
- **Migração**: adiciona `auto_format_multiplier`, faz backfill, mantém `pricing_model` por compatibilidade.

### `src/pages/Acabamentos.tsx`
- Substitui o `Select` "Modelo de cobrança" pelo grupo de 3 opções acima (radio cards com título + descrição curta + exemplos de uso).
- Quando "com multiplicador" estiver selecionado, mostra um info-box compacto listando os multiplicadores globais ativos (lê de `globalSettings`).
- "Somente tempo" continua escondendo preço e exigindo `time_minutes > 0`.
- `save()`: grava `auto_format_multiplier` em vez de derivar do `pricing_model`. Para retrocompat, também escreve `pricing_model` coerente (`per_sheet` se flag ligado, senão `per_unit`).
- Coluna na tabela ganha badge `×formato` (ícone Lucide + tooltip explicando) ao lado de itens com flag ligado, em vez do rótulo "Por folha/Por unidade".

### `src/lib/finishings/catalog.ts`
- `FinishingItem` ganha `auto_format_multiplier: boolean`.
- Helpers de cálculo (`calcFinishingCost`, `sumFinishingsPerSheet`) passam a olhar o novo flag. `pricing_model` ainda é lido como fallback para registros antigos enquanto a migração não rodou no usuário.

### `src/lib/labels/sheet-pricing.ts` e callers
- Onde hoje branch-a por `pricing_model === 'per_sheet'` para aplicar multiplicador, passa a branch-ar por `auto_format_multiplier`. Comportamento numérico idêntico.

### `src/integrations/supabase/types.ts`
- Regenerado automaticamente após a migração.

## UX — capricho

1. **Radio cards**, não dropdown — ver a explicação dos 3 modos de uma vez evita o "qual eu escolho?".
2. **Exemplos concretos** em cada modo ("Use para: ilhós, dobra…") — usuário identifica o caso dele rapidamente.
3. **Info-box dinâmico** do multiplicador lê os valores reais do sistema, então se mudar global de 2x pra 1.8x, o cadastro reflete sem código novo.
4. **Badge `×formato`** na listagem com tooltip explica por que aquele item escala — elimina a dúvida "por que SRA3 ficou 2x?".
5. **Sem termos técnicos**: nada de "per_sheet"/"per_unit" na UI; só "Por unidade" e "com multiplicador de formato".
6. **Migração transparente**: nenhum acabamento existente muda de preço; o usuário só nota a tela de cadastro mais clara.

## Riscos e mitigação

- **Risco**: cálculo legado em algum lugar ainda lê `pricing_model`. **Mitigação**: grep do projeto inteiro por `pricing_model` durante implementação; manter escrita dupla (flag + pricing_model coerente) por enquanto.
- **Risco**: usuário ligar o multiplicador num acabamento que não deveria escalar. **Mitigação**: descrição clara + badge visível na listagem para auditoria.

## Fora de escopo

- Não mexer em Comunicação Visual (`cv_calc_acabamentos`) — modelo lá é outro.
- Não remover `pricing_model` da tabela agora — fica para uma limpeza futura quando todos os ambientes estiverem atualizados.
