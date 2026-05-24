## Resposta curta

**Sim, é viável e recomendável** unificar conceitualmente. Hoje há duas tabelas que descrevem essencialmente a mesma coisa ("uma operação manual com tempo e, opcionalmente, preço"):

- `production_steps` (15 linhas) — id + descrição + minutos
- `finishings_price_items` (6 linhas, 4 vinculadas) — id + nome + categoria + preço/faixas + contexto (`applies_to`) + FK opcional ao step

Isso já gerou os sintomas que você viu: duplicidade de nomes ("Corte de 100 Cartões…" como step, "Recorte Folhas Adesivas" como acabamento), picker confuso, acabamentos sem etapa vinculada que não podem ser usados em kits, e o memory note "Fonte única (production_steps); Grupos são atalhos via FK" já assume um modelo único que não está realmente unificado.

## Modelo-alvo

Uma única entidade **Acabamento** com:

```
acabamentos
├── id
├── nome                       (ex.: "Corte reto")
├── categoria                  (recorte | laminação | encadernação | arte | montagem | …)
├── tempo_minutos              (labor; obrigatório)
├── aplica_a[]                 (etiqueta, impressao, cartao_visita, …)
├── modelo_preco               (none | per_sheet | per_unit | per_tier)
├── unidade                    (folha, ilhós, m², …)
├── preco_base / preco_por_folha
└── faixas[] (já existe em finishing_price_tiers)
```

Acabamentos sem cobrança própria (puramente labor, ex.: "Montagem") usam `modelo_preco = none` — o custo entra via `tempo_minutos × hourRate`. Acabamentos com cobrança fixa por folha mantêm o modelo atual.

## Caminhos de implementação

Duas opções com perfis bem diferentes de risco/retorno:

### Caminho A — Refactor profundo (estrutural, definitivo)

1. Adicionar colunas em `finishings_price_items`: `time_minutes`, `is_internal_step` (flag p/ steps puros sem preço).
2. Migrar as 15 linhas de `production_steps` para `finishings_price_items` (preservando ids? não — gerar mapping).
3. Adicionar `finishing_id` em: `product_kit_items`, `step_group_items`, `quote_labor_steps`, `quote_materials (catalog_source='finishing')`.
4. Backfill via mapping, dropar `process_step_id` / `production_step_id`.
5. Remover/depreciar `production_steps`, `step_groups`, `step_group_items` (ou mantê-los como views).
6. Renomear UI "Processos de Produção" → "Acabamentos" como módulo único.

**Esforço:** 1–2 dias de trabalho com migrações encadeadas, ajuste de ~10 arquivos (cart, kits, quotes, edge functions, OP PDF). **Risco:** médio-alto — toca pricing e PDFs.

### Caminho B — Unificação leve, pela UI (recomendado como 1º passo)

1. **Tornar Acabamentos o único cadastro visível ao usuário**. A página de "Processos de Produção" some do menu (ou vira aba interna read-only).
2. No CRUD de Acabamentos, o campo `time_minutes` passa a ser obrigatório e o sistema **cria/atualiza/apaga o `production_step` vinculado automaticamente** (trigger no banco ou no service do front). Resultado: toda acabamento sempre tem um step coerente, sem que o usuário precise saber disso.
3. Migração one-shot: para cada `production_step` sem `finishings_price_items` correspondente, criar uma linha em `finishings_price_items` com `pricing_model='none'` e `time_minutes = step.time_minutes`. Para os que duplicam ("Corte de 100…" vs "Recorte Folhas…"), apresentar tela de merge admin (ou deixar manual).
4. Picker de Kits, FinishingProgressive, OP PDF e quote pricing continuam usando `production_step_id` por baixo — **zero mudança nos consumidores**.
5. Memória `production` atualizada: "Acabamentos é a fonte única visível; production_steps é tabela interna gerenciada pelo cadastro".

**Esforço:** ~3–4 horas. **Risco:** baixo — sem mudança de schema dos FKs existentes. **Limitação:** ainda existem duas tabelas no banco; mas o usuário e a UI veem só uma.

## Recomendação

Fazer **Caminho B agora**: resolve 100% do problema do usuário (uma fonte só, sem duplicidade, sem item desabilitado no picker) sem mexer em pricing/cart/edge functions. Avaliar **Caminho A** depois de 1–2 ciclos de uso real, quando ficar claro se vale o custo de migrar todos os FKs.

Quer que eu detalhe e implemente o Caminho B?
