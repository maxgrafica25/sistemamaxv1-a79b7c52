## Fase 1 — Ordenação visual de acabamentos por mídia

### Hoje
`cv_calc_acabamentos.sort_order` é global — uma única ordem serve todas as mídias, e não há como esconder "Corte 3mm" da lista de **lona** sem desativar o acabamento inteiro.

### Schema (nova tabela leve, sem mexer em `cv_calc_acabamentos`)

```
cv_calc_acabamento_media_order
  acabamento_id  uuid  FK → cv_calc_acabamentos (cascade)
  tipo_midia     text  ('lona' | 'adesivo' | 'chapa' | 'outro')
  sort_order     int
  visivel        bool  default true
  PRIMARY KEY (acabamento_id, tipo_midia)
```

- Quando não há linha para um par (acabamento, mídia), cai no `sort_order` global → 100% compatível com o que já existe.
- `visivel=false` esconde o acabamento naquela mídia mesmo que `tipos_midia_compativeis` permita.
- RLS: admin all + authenticated select (mesmo padrão das outras `cv_calc_*`).

### UI — nova sub-aba "Ordem por mídia" dentro de **Cadastros CV → Acabamentos**

Layout em 4 colunas, uma por tipo de mídia:

```text
┌─ Lona ──────┐ ┌─ Adesivo ───┐ ┌─ Chapa ─────┐ ┌─ Outro ─────┐
│ ☰ Bainha+Il │ │ ☰ Refile    │ │ ☰ Dupla Face│ │ ☰ Outro 1   │
│ ☰ Ilhós     │ │ ☰ Laminação │ │ ☰ Ilhós Cha │ │             │
│ ☰ Emenda    │ │ 👁 Corte3mm │ │ ☰ Display   │ │             │
│ 👁 Dupla F. │ │             │ │ ☰ Laminação │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
```

- Drag-and-drop vertical com `@dnd-kit/sortable` → ao soltar, persiste o `sort_order` daquela coluna.
- Ícone de olho (Eye / EyeOff) para mostrar/ocultar o item naquela mídia.
- Botão "Resetar para ordem global" no topo de cada coluna.

### Aplicar a ordem no resto do sistema

Locais que listam acabamentos para escolha: `CVItemCard`, `CalculadoraTab`, `SmartFinishingBlock`. Em todos, ao carregar a lista filtrada por mídia, aplicar:

```ts
const ordered = acabamentos
  .filter(a => a.tipos_midia_compativeis.includes(midiaSelecionada))
  .map(a => {
    const m = mediaOrder.find(o => o.acabamento_id === a.id && o.tipo_midia === midiaSelecionada);
    return { ...a, _order: m?.sort_order ?? a.sort_order, _visivel: m?.visivel ?? true };
  })
  .filter(a => a._visivel)
  .sort((x, y) => x._order - y._order);
```

`mediaOrder` carregado uma vez no `Promise.all` que já existe nesses componentes.

---

## Fase 2 — Perguntas-chave contextuais no orçamento

### Princípio
Não poluir. As perguntas só aparecem **quando relevantes** num único bloco recolhível **"Checklist do orçamento"** no topo do formulário, com badge contando pendentes. Nunca bloqueia salvar.

### Schema

```
quote_checklist_questions            (admin gerencia)
  id            uuid
  pergunta      text       -- "Necessita desinstalar lona antiga?"
  tipo_resposta text       -- 'sim_nao' | 'sim_nao_valor' | 'texto' | 'foto'
  categoria     text       -- 'instalacao' | 'remocao' | 'logistica' | 'arte' | 'outro'
  hint          text       -- explicação curta do porquê
  ativo         bool
  sort_order    int

quote_checklist_triggers             (quando a pergunta dispara)
  id              uuid
  question_id     uuid FK
  tipo_midia      text[]    -- ex.: ['lona']
  familia_acab    text[]    -- ex.: ['ilhos'] (opcional)
  area_min_m2     numeric   -- opcional
  area_max_m2     numeric
  altura_min_m    numeric   -- útil para "precisa de andaime?"
  sempre          bool      -- ignora filtros se true

quote_checklist_answers              (respostas do orçamento)
  quote_id      uuid
  question_id   uuid
  resposta_bool bool
  resposta_num  numeric
  resposta_text text
  resposta_url  text       -- foto enviada → storage
  PRIMARY KEY (quote_id, question_id)
```

RLS: admin gerencia perguntas/triggers; authenticated lê tudo e escreve respostas.

Bucket `quote-attachments` (private) para as fotos do checklist.

### UI no orçamento (`NewQuoteFormV2`)

Componente novo `QuoteChecklist` no topo do formulário:

```text
📋 Checklist do orçamento                       [2 pendentes ▼]
─────────────────────────────────────────────────
⚠ Lona detectada (8m²)
  • Precisa desinstalar a lona antiga?      ( ) Sim ( ) Não  [+ R$]
  • Local exige andaime (altura > 3m)?       ( ) Sim ( ) Não
  • Foto do local                            [📎 Anexar]

✓ Adesivo grande (5m²)
  • Remover adesivo atual?                   ( ) Sim ( ) Não
```

Lógica:
- Recalcula (debounced) a cada mudança nos itens qual conjunto de perguntas dispara, baseando-se em `tipo_midia`, `familia`, área total e altura.
- Persiste respostas em `quote_checklist_answers` no salvar.
- "Sim" em pergunta `sim_nao_valor` adiciona automaticamente um item de **mão-de-obra avulsa** ao orçamento (ex.: "Desinstalação de lona antiga — R$ X"), que o usuário pode editar/remover. Valor padrão configurável por pergunta.
- Foto: upload para `quote-attachments`, vinculada ao quote.
- Badge no botão de gerar PDF se houver pendentes — **sem bloquear**.

### Tela admin — nova aba **"Checklist"** em Cadastros CV

- Tabela CRUD das perguntas
- Para cada pergunta: editar triggers (multi-select de mídias/famílias, inputs de área min/max e altura, switch "sempre perguntar")
- Toggle ativo
- Drag para reordenar (mesma lib da Fase 1)

### Seed inicial sugerido

| Pergunta | Trigger | Tipo |
|---|---|---|
| Necessita desinstalar lona antiga? | midia=lona, area≥4 | sim_nao_valor |
| Precisa retirar adesivo atual antes da aplicação? | midia=adesivo, area≥3 | sim_nao_valor |
| Local exige andaime / plataforma elevatória? | midia ∈ (lona,adesivo), altura≥3 | sim_nao |
| Foto do local de instalação | midia ∈ (lona,adesivo), area≥4 | foto |
| Cliente fornecerá arte final ou é necessário criação? | sempre | sim_nao_valor |
| Há iluminação/back-light atrás da lona? | midia=lona | sim_nao |

---

## Roadmap futuro (não entra agora)

**Fase 3 — Assistente Inteligente** (conforme já alinhado): sugestões por regra (`quote_suggestion_rules`), por padrão de coocorrência histórica e via LLM. Depende dos dados gerados pela Fase 2 para ter utilidade real.

---

## Ordem de execução

1. Migration: `cv_calc_acabamento_media_order` + RLS
2. UI Fase 1: sub-aba "Ordem por mídia" com dnd-kit
3. Aplicar ordem por mídia em `CVItemCard`, `CalculadoraTab`, `SmartFinishingBlock`
4. Migration: `quote_checklist_questions` + `_triggers` + `_answers` + RLS + bucket `quote-attachments`
5. Seed das 6 perguntas iniciais
6. UI Admin: aba "Checklist" com CRUD e editor de triggers
7. UI Orçamento: componente `QuoteChecklist` no topo do `NewQuoteFormV2` + criação automática de mão-de-obra a partir de respostas "Sim" + salvar respostas

## Decisões a confirmar antes de implementar

1. **Esconder vs desativar:** marcar o olho como oculto em "lona" mantém o acabamento ativo nas outras mídias (adesivo/chapa) — é o objetivo da feature, só confirmando.
2. **Mão-de-obra automática:** o "Sim" em `sim_nao_valor` deve **adicionar automaticamente** o item ao orçamento (com valor padrão editável) ou apenas registrar a resposta e deixar você adicionar manualmente?
3. **Foto do local:** vincular **só ao orçamento** ou também ao **cliente** (galeria de fotos do cliente para reaproveitar em pedidos futuros)?
4. **Ordem de entrega:** posso entregar a **Fase 1 primeiro** (menor, valida o padrão de UI dnd) e depois a Fase 2, ou prefere as duas no mesmo bloco?
