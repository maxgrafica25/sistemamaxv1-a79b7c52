## Pergunta "Tem arte pronta?" por item (v3)

### O que muda
Cada item de impressão/CV no v3 (PrintForm, PrintAndProductForm, BusinessCardForm, CVForm, BookletForm, LabelEmbeddedForm) recebe um bloco no topo:

```
Arte
( ) Sim, cliente envia arte pronta
( ) Não, precisamos criar
    └─ [Ajuste] [Fácil] [Moderada] [Elaborada] [+30min terceirizada]
```

A resposta é obrigatória — o item não pode ir ao carrinho sem ela. O carrinho mostra a marcação ("Arte: pronta" ou "Arte: Moderada — 20min").

### Seed das 4 complexidades

Criados como `production_steps` (step_type `acabamento`) + `finishings_price_items` vinculados via `production_step_id` (mesmo padrão usado hoje pelo fluxo Etapa→Acabamento), `applies_to = {impressao, etiqueta}`:

| Nome | time_minutes |
|---|---|
| Arte — Ajuste (até 5min) | 5 |
| Arte — Fácil (5–10min) | 10 |
| Arte — Moderada (10–20min) | 20 |
| Arte — Elaborada (20–30min) | 30 |

O custo sai automaticamente pelo `hourly_rate × time_minutes/60` que já existe. Aparecem em Processos→Etapas e em Acabamentos como qualquer outro.

### Acima de 30min (terceirizada)

Botão "+30min — terceirizar" abre um campo numérico simples ("Valor da arte terceirizada R$ ___") + aviso amarelo "Confirmar valor com diretor antes de enviar". Esse valor entra como `quote_third_party` no item, com descrição "Arte terceirizada".

### Bloqueio de envio
Validação no `NewQuoteFormV3` / `saveQuoteV3`: se qualquer item não tiver `art_status` definido (`ready` | `ajuste` | `facil` | `moderada` | `elaborada` | `terceirizada`), o botão "Salvar/Enviar" fica desabilitado com tooltip "Responda 'Tem arte pronta?' em todos os itens".

### Mudanças técnicas

**Migração** (1 arquivo):
- Adiciona coluna `art_status text` em `quote_materials` (nullable; itens antigos ficam `null`, validação só exige em criação nova).
- Cria os 4 `production_steps` + 4 `finishings_price_items` vinculados (idempotente via `ON CONFLICT DO NOTHING` no nome).

**Frontend**:
- `src/components/orcamentos-v3/forms/shared/ArtePromptBlock.tsx` (novo) — componente reutilizável com os 5 botões + campo de terceirização.
- Cada form da lista acima importa `ArtePromptBlock` no topo e expõe `art_status` no payload do item.
- `cart/UnifiedCart.tsx` mostra badge "Arte: …" e item filho de terceirização quando aplicável.
- `saveQuoteV3.ts` persiste `art_status`; quando seleciona uma das 4 faixas, anexa o `finishings_price_items` correspondente como filho (mesmo fluxo de acabamento existente). Quando `terceirizada`, grava `quote_third_party`.
- Validação de envio em `NewQuoteFormV3`.

### Fora de escopo
- Não mexe em v1/v2.
- Não cria categoria nova de step_type — mantém `acabamento`.
- Não cria página de gestão de "tipos de arte" — edição feita direto em Processos→Etapas (descrição/tempo) e em Acabamentos (preço/multiplicadores), como qualquer etapa.
