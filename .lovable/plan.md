
# Kits Sugeridos por Produto — solução definitiva

Objetivo: tornar os "Kits de acabamento" (hoje hardcoded só para Apostila) **cadastráveis pelo usuário** e disponíveis em **qualquer tipo de produto** (apostila, cartão, banner, bloco, folder, adesivo etc.), sem mexer em código quando o catálogo mudar.

---

## 1. Banco (migration)

Duas tabelas novas em `public`:

**`product_kits`** — o "kit" em si, vinculado a um tipo de produto.
- `name` (ex.: "Kit Encadernação Apostila")
- `product_kind` (texto livre, ex.: "apostila", "cartao", "banner") — usado para casar com o `product_kind` do orçamento
- `description`, `is_active`, `created_by`, timestamps

**`product_kit_items`** — itens dentro do kit.
- `kit_id` → `product_kits`
- `position` (ordem)
- `item_type` (`supply` | `process`) — define em qual catálogo buscar
- `supply_id` → `supplies` (quando supply) **ou** `process_step_id` → `production_steps` (quando process)
- `role` (`required` | `optional` | `alternative`) — controla UX no painel: required = sempre marcado, optional = checkbox, alternative = radio
- `alternative_group` (texto, ex.: "capa") — itens alternativos compartilham o mesmo grupo; o usuário escolhe 1
- `quantity_formula` (`per_unit` | `per_sheet` | `per_x_sheets` | `per_perimeter_m` | `per_m2` | `fixed` | `auto_spiral`)
- `quantity_value` (numérico — multiplicador ou valor fixo; default 1)
- `auto_select_default` (boolean — pré-marcado ao abrir o painel)
- `notes`

RLS: leitura para `authenticated`, escrita só para `admin` (via `is_profile_admin`).

Sem trigger; sem dados seed (usuário cadastra do zero ou roda script de seed do kit atual de apostila).

---

## 2. Tela de cadastro — Grupos de Materiais → nova aba "Kits de Produto"

Em `src/pages/GruposMateriais.tsx`, adicionar aba `Kits` (componente novo `ProductKitsTab.tsx`):

- **Lista**: cards de kits por `product_kind`, com toggle ativo/inativo, contagem de itens, ação editar/duplicar/excluir.
- **Dialog "Novo/Editar Kit"**:
  - Nome + Tipo de produto (combo com sugestões: apostila, cartão, banner, bloco, folder, adesivo, convite — texto livre)
  - Lista reordenável de itens, cada linha:
    - Tipo (Suprimento / Processo) → busca no catálogo (`supplies` ou `production_steps`)
    - Papel: `Obrigatório` / `Opcional` / `Alternativo`
    - Se Alternativo → input "Grupo de alternativas" (ex.: "capa") — itens com mesmo grupo aparecem como radio para o cliente
    - Fórmula de quantidade (combo) + valor
    - Pré-marcado? (checkbox)
  - Validações: kit precisa ter ≥1 item; grupos alternativos precisam ter ≥2 itens.

---

## 3. Motor de aplicação do kit (frontend, `shared/productKit.ts`)

Função `buildKitRows({ kit, productKind, units, sheets, perimeterM, areaM2, supplies, steps, hourlyRate, defaultMarginPct })` que devolve `KitRow[]` no mesmo formato do `bookletKit.ts` atual (label, descrição, qty, custo, fallback, `build()` → `V3Item`).

Resolve `quantity_formula`:
- `per_unit` → `units * quantity_value`
- `per_sheet` → `units * sheets * quantity_value`
- `per_x_sheets` → `units * ceil(sheets / quantity_value)`
- `per_perimeter_m` → `units * perimeterM * quantity_value`
- `per_m2` → `units * areaM2 * quantity_value`
- `fixed` → `quantity_value`
- `auto_spiral` → reaproveita `getIdealSpiral(sheets)` + seleciona supply por nome do diâmetro (única regra "inteligente" hardcoded restante)

---

## 4. Painel genérico `ProductKitPanel.tsx`

Substitui `BookletKitPanel`. Props: `productKind`, `units`, `sheets?`, `perimeterM?`, `areaM2?`, `defaultMarginPct`, `onApply(items)`.

- Busca kits ativos onde `product_kind = productKind` (pode ter mais de um → tabs/select se houver vários).
- Renderiza linhas conforme `role`:
  - `required` → checkbox marcado e desabilitado
  - `optional` → checkbox livre (default = `auto_select_default`)
  - `alternative` (por grupo) → radio group
- Botão **"Aplicar Kit"** monta os `V3Item[]` e chama `onApply`.
- Itens não encontrados no catálogo aparecem com badge amarelo "preencher" (comportamento atual mantido — usuário cadastra na hora no carrinho).

---

## 5. Integração nos forms de orçamento

Em cada form que tiver um `productKind` definido (`BookletForm`, `PrintForm`, `PrintAndProductForm`, `LabelEmbeddedForm`), incluir `<ProductKitPanel>` quando houver kit ativo para aquele tipo. Calcula `sheets/perimeterM/areaM2` a partir dos campos já existentes do form.

`BookletKitPanel` antigo é removido — `BookletForm` passa a usar o painel genérico com `productKind="apostila"`.

---

## 6. Migração do kit atual de apostila

Script de seed (insert) opcional que cria o kit "Apostila padrão" replicando a lógica atual:
- Capa PP Line A4 Incolor — supply, required, per_unit×1
- Capa PP Camurça A4 Preta — supply, required, per_unit×1
- Espiral — supply, required, auto_spiral
- Furação — process, required, per_unit×1 (tempo do processo × unidades)
- Encadernação — process, required, per_unit×1

Para cobrir a regra "capa personalizada em couchê 300g": adicionar 2 itens alternativos no grupo "capa":
- Capa PP Line A4 Incolor — alternative (group=capa), default
- Couchê 300g A4 — alternative (group=capa)

Usuário pode editar/expandir depois pela tela.

---

## 7. Fora de escopo

- Tabela de regras dinâmicas cadastráveis (só `auto_spiral` continua hardcoded — atende 99% e evita tela complexa).
- Editar kits aplicados em orçamentos antigos (já salvos no `quote_materials`).
- Sugestão automática de kit por nome do produto (continua usando `product_kind` explícito).

---

## Detalhes técnicos

```text
product_kits (id, name, product_kind, description, is_active, created_by, created_at, updated_at)
product_kit_items (
  id, kit_id, position, item_type ('supply'|'process'),
  supply_id, process_step_id,
  role ('required'|'optional'|'alternative'),
  alternative_group,
  quantity_formula ('per_unit'|'per_sheet'|'per_x_sheets'|'per_perimeter_m'|'per_m2'|'fixed'|'auto_spiral'),
  quantity_value, auto_select_default, notes
)
```

Sequência de PRs:
1. Migration (tabelas + RLS) — precisa de aprovação
2. `shared/productKit.ts` + `ProductKitPanel.tsx`
3. Aba `Kits de Produto` em `GruposMateriais.tsx`
4. Trocar `BookletKitPanel` pelo genérico no `BookletForm`
5. Plugar painel nos demais forms (Cartão, Banner etc.) conforme `product_kind`
6. Seed opcional do kit Apostila

---

Posso seguir? Começo pela **migration** das tabelas; depois sigo com a UI sem precisar de novas aprovações.
