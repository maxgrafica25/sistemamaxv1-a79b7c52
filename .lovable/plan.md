## Problema

O cadastro de Suprimento hoje só pede **Quantidade** e **Valor Total** — sem informar **em que unidade**. Isso funciona para itens contáveis (ponteira, espiral, parafuso), mas quebra para insumos vendidos por medida contínua:

- **Cordinha, fita, cabo, fio** → metro linear (m)
- **Lona em rolo, tecido** → metro quadrado (m²)
- **Cola, pó, granulado** → quilo (kg)
- **Tinta, verniz, solvente** → litro (L)

Sem esse campo, o "Valor Unitário" calculado fica ambíguo (R$ 0,35 por quê?) e atrapalha tanto o histórico de preços quanto futuros cálculos de consumo em orçamentos.

## Solução

Adicionar um campo **Unidade de Medida** ao cadastro de suprimento, com opções pré-definidas e exibição clara em toda a interface.

### 1. Banco de dados

Migration adicionando coluna `unidade` em `public.supplies`:
- Tipo: `text`, NOT NULL, default `'un'` (para não quebrar registros existentes)
- Valores aceitos via CHECK ou apenas validação no front: `un`, `m`, `m²`, `kg`, `g`, `L`, `mL`, `pç`, `cx`

### 2. Modal "Novo/Editar Suprimento" (`src/pages/MateriasPrimas.tsx`)

Reorganizar a linha de Quantidade/Valor para incluir o seletor:

```text
┌──────────────┬──────────────┬──────────────────┐
│ Quantidade * │ Unidade *    │ Valor Total (R$)*│
│ [   100   ]  │ [ metro  ▼ ] │ [    35,00     ] │
└──────────────┴──────────────┴──────────────────┘
```

- Grid passa de `grid-cols-2` para `grid-cols-[1fr_120px_1fr]` (ou 3 colunas iguais).
- Default da unidade: `un` (mantém comportamento atual para itens contáveis).
- Label do "Valor Unitário" calculado passa a mostrar a unidade: **"R$ 0,35 / metro"** em vez de só "Valor Unitário: R$ 0,35".

### 3. Tabela de Suprimentos

- Coluna **Unit.** atual (preço unitário) passa a exibir `R$ 0,35 / m` em vez de só `R$ 0,35`.
- Opcional (recomendado): coluna "Quantidade" mostra `100 m` em vez de só `100`.

### 4. Histórico de preços / duplicação

- Ao duplicar (`duplicateMaterial`), copia também a unidade.
- No histórico exibido no painel lateral, mostrar a unidade junto do valor unitário para o usuário comparar maçãs com maçãs.

## Arquivos afetados

- `supabase/migrations/<nova>.sql` — adicionar coluna `unidade`
- `src/pages/MateriasPrimas.tsx` — estado `unidade`, select no modal, exibição na tabela, propagação no duplicate/edit/save
- Constante nova `UNIDADES_MEDIDA` no topo do arquivo (ou em `src/lib/utils.ts` se preferir reuso)

## Fora de escopo (sugestão futura)

- Conversão automática entre unidades (ex.: comprei rolo de 100m, quero gastar 1,5m no orçamento) — só vale a pena quando o módulo de Orçamentos consumir suprimentos por unidade real.
- Adicionar a mesma coluna em `papers` — papel já é sempre por folha, não precisa.
