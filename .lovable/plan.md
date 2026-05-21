## Objetivo

Padronizar a entrada dos formulários de "Impressão + Acabamentos" e "Comunicação Visual" (Etiquetas) com o toggle **Produtos | Personalizado**, sempre nessa ordem, e abrindo por padrão em **Produtos**.

## 1. Impressão + Acabamentos (`PrintAndProductForm.tsx`)

Trocar apenas a ordem e o default — sem mexer na lógica de sugestão/presets.

- Linha 31: `useState<Mode>("custom")` → `useState<Mode>("product")` (abre já em Produtos).
- Linhas 70–83: inverter os dois `<ModeButton>` para que **Produto** apareça primeiro e **Personalizado** depois. Padronizar o label para **"Produtos"** (plural), igual ao pedido do usuário.
- Nada muda em chips, sugestão, formulários internos ou submit.

## 2. Comunicação Visual / Etiquetas (`LabelEmbeddedForm.tsx`)

Hoje o form abre direto em modo livre. Adicionar o mesmo toggle no topo, na mesma posição visual do form de Impressão.

- Novo estado `mode: "product" | "custom"`, default `"product"`.
- Renderizar, antes de qualquer campo (acima de Descrição/Folha), o mesmo bloco:
  ```
  <div className="inline-flex rounded-md border border-border bg-muted/40 p-1">
    <ModeButton active={mode==="product"} icon={Wand2} label="Produtos" />
    <ModeButton active={mode==="custom"}  icon={Pencil} label="Personalizado" />
  </div>
  ```
  Reaproveitar o componente `ModeButton` extraindo-o para `shared/ModeButton.tsx` (mesmo arquivo usado pelos dois forms) — sem alterar visual.
- **Modo Produtos**: mostrar chips com os favoritos de etiqueta vindos de `loadConfig().presets` (`LabelPreset[]` em `src/lib/labels/config-storage.ts`, já com `SEED_LABEL_PRESETS`). Cada chip aplica os valores do preset (`labelW`, `labelH`, `shape`, `sheetId`, `quantidade` se houver) nos states existentes e mantém o restante do formulário visível para ajustes — mesmo padrão visual dos chips de produto em Impressão.
- **Modo Personalizado**: comportamento atual (sem chips), preservando todos os campos e a integração com `TierSimulator`/`onAdd`/`onAddTiers`.
- Nenhuma mudança em cálculo, pricing, submit, tiers ou tipos.

## 3. Fora do escopo

- Lógica de sugestão automática para etiquetas (não solicitada).
- Persistência de qual modo o usuário usou por último.
- Alterações nos demais formulários (Booklet, CV, Supply, ThirdParty).

## Arquivos afetados

- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — reordenar toggle + default.
- `src/components/orcamentos-v3/forms/LabelEmbeddedForm.tsx` — adicionar toggle + chips de favoritos.
- `src/components/orcamentos-v3/shared/ModeButton.tsx` (novo) — extrair o botão hoje local em `PrintAndProductForm` para reuso.
