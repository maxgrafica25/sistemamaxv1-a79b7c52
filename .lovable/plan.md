## Plano — Descrições corretas + vínculo opcional Acabamento ↔ Etapa

### Objetivo
1. Corrigir as descrições das abas de Produção para refletir o que cada uma realmente faz.
2. Permitir vincular um **Acabamento** (preço/folha) a uma **Etapa** (tempo de execução), eliminando a duplicidade de cadastro sem forçar fusão dos conceitos.

---

### Parte 1 — Descrições das abas (`src/pages/ProcessosProducao.tsx`)

Reescrever o objeto `tabDescriptions`:

- **Etapas** (`Clock`) — "Cadastre cada etapa do processo de produção e o **tempo de execução** em minutos. Esse tempo alimenta o cálculo de mão de obra dos orçamentos."
- **Acabamentos** (`Scissors`) — "Tabela de **preços por folha** dos acabamentos (recorte, laminação, verniz…). Cada acabamento pode ter **faixas por quantidade de folhas** da tiragem — a calculadora escolhe automaticamente a faixa correspondente. Sem faixas, usa o preço base."
- **Grupos de Etapas** (`Layers`) — sem mudança conceitual.
- **Grupos de Materiais** (`Layers`) — sem mudança conceitual.
- **Kits de Produto** (`Sparkles`) — sem mudança conceitual.

Trocar ícone de Acabamentos de `Sparkles` para `Scissors` (consistente com a página Acabamentos).

---

### Parte 2 — Vínculo opcional Acabamento → Etapa

#### Migração de banco
- Adicionar coluna `production_step_id UUID NULL` em `finishings_price_items` com FK para `production_steps(id) ON DELETE SET NULL`.
- Sem alteração em RLS (herda as policies existentes da tabela).
- Sem trigger novo: apenas FK.

#### UI — Página Acabamentos (`src/pages/Acabamentos.tsx`)
- No dialog de cadastro/edição, adicionar campo:
  - **Label:** "Etapa de produção associada (opcional)"
  - **Componente:** `Select` com lista de `production_steps` (`description` + tempo em minutos como dica).
  - **Helper text:** "Quando preenchida, o tempo dessa etapa é puxado automaticamente ao usar o acabamento em orçamentos."
- Persistir `production_step_id` no insert/update/clone.
- Na tabela de listagem, mostrar uma coluna pequena ou um ícone `Clock` ao lado do nome quando houver vínculo (tooltip com o nome da etapa + minutos).

#### Hook auxiliar
- Reaproveitar fetch existente de `production_steps` (já consumido em outras telas) ou fazer um `select id, description, time_minutes` simples dentro do componente.

---

### Parte 3 — Consumo nos orçamentos (escopo mínimo agora)

Esta etapa **só prepara o dado**. O consumo real (puxar o tempo automaticamente ao selecionar o acabamento) será feito em iteração seguinte, depois de você confirmar onde no fluxo do orçamento isso deve aparecer (Print V3? Etiquetas? Ambos?). Hoje os formulários de orçamento já tratam acabamentos e mão de obra separadamente, e mexer neles sem confirmação de fluxo desejado pode quebrar cálculo de preço.

**Entrega desta rodada:** banco + UI do cadastro. Próxima rodada: integração no formulário de orçamento que você apontar.

---

### Arquivos tocados
- Migration nova (coluna `production_step_id`)
- `src/pages/ProcessosProducao.tsx` — descrições + ícone
- `src/pages/Acabamentos.tsx` — campo no dialog + leitura no clone + coluna/indicador opcional na tabela

### Fora de escopo
- Unificação total das tabelas
- Mudanças em RLS
- Integração automática do tempo no orçamento (rodada seguinte)
