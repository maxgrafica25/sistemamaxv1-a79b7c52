## Correções na Calculadora de Etiquetas

### 1. Nova tela: Tabela de Acabamentos (com Recorte)

**Por quê:** o preço final da folha de etiqueta = **Adesivo (impressão)** + **Recorte (acabamento de plotter)**. O recorte é um serviço independente que pode ser reutilizado em outros contextos no futuro (laminação, verniz, etc.), por isso ganha tabela própria — não vai entrar em `printing_price_items`.

**Schema novo (`finishings_price_items`):**

```text
id                uuid pk
name              text     -- ex.: "Recorte plotter quadrado", "Recorte plotter redondo"
category          text     -- ex.: "recorte", "laminacao", "verniz" (extensível)
size              text     -- "SRA3" | "A4" | "A3" | "33x48" (mesma convenção da tabela atual)
price_per_sheet   numeric  -- preço fixo por folha
is_active         boolean
sort_order        int
created_at, updated_at
```

RLS igual a `printing_price_items`: leitura para autenticados, escrita só admin.

**Nova rota `/acabamentos`** (`src/pages/Acabamentos.tsx`) — telinha simples (CRUD em tabela), com o mesmo visual de `/preco-impressao` (Lucide `Scissors` + roxo). Item no Sidebar logo abaixo de "Preço Impressão".

### 2. Calculadora puxa preço de duas fontes

Na coluna direita da `/calculadora-etiquetas`, dentro do card "Cálculo do orçamento" (sempre visível agora), substituir o input manual de preço por **dois selects encadeados**:

```text
Composição do preço da folha
  Impressão:  [Adesivo Brilho · A3 · F · color ▾]   R$ 1,43/folha
  Acabamento: [Recorte plotter redondo ▾]            R$ 0,80/folha
  Total:      R$ 2,23/folha   [Editar tabelas ↗]
```

- Select de **impressão** lista entradas ativas de `printing_price_items` filtradas pelo `size` da aba de folha selecionada (SRA3/A4/A3/33×48).
- Select de **acabamento** lista entradas ativas de `finishings_price_items` filtradas pelo mesmo `size`. Inclui opção "Sem acabamento" (R$ 0).
- `pricePerSheet` derivado = `printing.paper_cost + printing.printing_cost + finishing.price_per_sheet`. Não persiste em `LabelCalcConfig` — passa a ser estado de runtime.
- Última escolha (id da impressão + id do acabamento) lembrada por `size` no `localStorage` (`labelCalc:priceChoice:v1`).
- Quando troca a aba de folha no topo: o select se auto-reposiciona para a última escolha daquele tamanho (ou primeira opção disponível).

**Quando faltar cadastro** (ex.: SRA3 sem item em Tabela de Preços ou em Acabamentos):
```text
⚠ Não há "Recorte" cadastrado para SRA3.
   [Cadastrar agora →] (abre /acabamentos em nova aba)
```
Botões WhatsApp/PDF ficam desabilitados com tooltip explicando o que falta.

**Remover** o campo "Preço por folha (R$)" do `LabelCalcSettingsDialog` e o uso de `pricePerSheet` em `loadConfig/saveConfig` (mantém leitura para retro-compat e descarta).

### 3. Card de Cálculo + WhatsApp + PDF SEMPRE visíveis

Hoje o card só renderiza se `pricePerSheet > 0`. Vai passar a renderizar sempre que `qty > 0` e `perSheet > 0`:
- Topo: bloco de composição de preço (item 2).
- Meio: total + custo unitário (ou "—" enquanto faltar dado).
- Base: **Copiar WhatsApp / Abrir WhatsApp / Gerar PDF de produção**, sempre montados, com `disabled` + tooltip quando faltar preço/quantidade.

### 4. Gap padrão Teneth = 1mm (Regra dos 40)

Em `src/lib/labels/layout.ts`:
- `CUT_DEFAULTS.plotter_redondo.gap`: `3` → `1`
- `CUT_DEFAULTS.plotter_quadrado.gap`: `2` → `1`

Resultado para 50×50 em SRA3 com Teneth (área útil 306×363): `cols=floor(307/51)=6`, `rows=floor(364/51)=7` → **42 etiquetas/folha** (supera o alvo 40). Para usuários com gap antigo no localStorage, basta clicar "Padrão de corte" no diálogo (botão já existe).

A detecção de colisão atual (`computeReservedSlots`) já está correta (TOL 0.5mm; "L" superior com vértice no canto da área útil + braços para FORA; ticks dentro da margem inferior). Confirmado: nenhuma etiqueta é bloqueada.

### 5. Marcas inferiores como TICKS (não L)

A geometria já está correta em `src/lib/labels/marks.ts`. O que pode dar aparência de "L" no preview reduzido é o `strokeLinecap="round"` engrossando as pontas. Ajustes:

- **Preview SVG**: `strokeLinecap="butt"` para ticks; `strokeWidth` proporcional à escala.
- **PDF (`production-pdf.ts`)**: confirmar `drawMark` desenha 1 linha horizontal de 10mm em K100 0.5pt para tick. Comentário inline "TL/TR=L; BL/BR=tick".
- **Teste**: asserção em `labels-layout.test.ts` validando `markSegments(tick).length === 1`.

### 6. Refresh ao trocar de aba de folha

Em `handleQuickSheet`:
- Resetar `marksOffsetY = 0`.
- Re-aplicar a opção de impressão+acabamento salva para o novo `size` (item 2).
- Toast curto: `"Folha alterada para SRA3 — cálculo atualizado"`.

### Arquivos a editar / criar

**Banco:**
- Migration: criar `finishings_price_items` + RLS + 2 seeds ("Recorte plotter quadrado" e "Recorte plotter redondo" com `price_per_sheet=0` para o usuário preencher).

**Front:**
- `src/pages/Acabamentos.tsx` *(novo)* — CRUD básico.
- `src/App.tsx` + `src/components/Sidebar.tsx` — registrar rota e item de menu.
- `src/lib/labels/layout.ts` — defaults de gap (3→1, 2→1).
- `src/lib/labels/config-storage.ts` — remover `pricePerSheet` do tipo público.
- `src/lib/labels/sheet-pricing.ts` *(novo)* — hook `useFolhaPricing(size)` que retorna `{ printingOptions, finishingOptions, selected, total, missing }` consultando ambas tabelas.
- `src/components/labels/LabelLayoutCalculator.tsx`:
  - Card de orçamento sempre montado, com selects de impressão + acabamento.
  - Botões WhatsApp/PDF sempre visíveis (disabled quando faltam dados).
  - `handleQuickSheet` reseta offset e re-puxa preços.
  - SVG de ticks com `strokeLinecap="butt"`.
- `src/components/labels/LabelCalcSettingsDialog.tsx` — remover campo "Preço por folha".
- `src/lib/labels/production-pdf.ts` — verificar tick K100 0.5pt.
- `src/test/labels-layout.test.ts` — atualizar para gap=1, adicionar "50×50 em SRA3 = 42 etiquetas" e teste de geometria do tick.

### Resultado esperado

- Novo menu lateral **"Acabamentos"** onde você cadastra "Recorte SRA3 = R$ 0,80", "Recorte A3 = R$ 0,50", etc.
- `/calculadora-etiquetas` mostra: **"42 etiquetas por folha"** para 50×50 em SRA3.
- Card de orçamento sempre visível, com selects de Impressão + Recorte puxando os preços de cada tabela. Total e custo unitário recalculam ao trocar qualquer um.
- Mudou o preço do Adesivo na Tabela de Preços ou o do Recorte em Acabamentos → calculadora reflete na hora. Zero duplicação.
- Trocar aba de folha (SRA3 → A4): selects acompanham, preço recarrega, contagem e desenho atualizam.
- Pé do desenho: dois traços horizontais simples nos cantos.
