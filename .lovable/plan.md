# Selects cadastrados para Papel inclui/exclui e Acabamentos sugeridos

## Contexto
Hoje os campos em `src/pages/QuotePresets.tsx` (linhas 385–396) são `<Input>` de texto livre — fácil errar grafia (ex: "couchê" vs "couche") e o usuário não vê o que está cadastrado. Vamos trocar por seletores baseados no catálogo real.

## Catálogo
- Papéis: `SELECT DISTINCT paper_type FROM printing_price_items WHERE is_active`.
- Acabamentos: `listFinishings("impressao")` de `src/lib/finishings/catalog.ts`.

## Componente novo
Criar `src/components/orcamentos-v3/shared/ChipMultiPicker.tsx`:
- Props: `label`, `options: { value: string; group?: string }[]`, `value: string[]`, `onChange(next)`, `groupLabels?: Record<string,string>`, `emptyHint?`.
- Render: para cada grupo, mostra o nome do grupo + botão pequeno **"+ Todos deste tipo"** e a lista de chips clicáveis (toggle). Chips selecionados ficam preenchidos com `primary`; não selecionados com borda.
- Acima dos grupos: botões **"Selecionar todos"** e **"Limpar"**.
- Reutilizável para Papel inclui, Papel exclui e Acabamentos sugeridos (sem agrupamento neste último).

## Carregamento dos catálogos
Em `QuotePresets.tsx`:
- Adicionar `useEffect` que ao montar busca:
  - `paperTypes` via `supabase.from("printing_price_items").select("paper_type").eq("is_active", true)` → distinct + classificar por categoria com helper:
    ```ts
    function paperCategory(name: string): "adesivo" | "cartao" | "papel" {
      const n = name.toLowerCase();
      if (/adesiv/.test(n)) return "adesivo";
      if (/crach|pvc|cart(a|ã)o/.test(n)) return "cartao";
      return "papel";
    }
    ```
    `groupLabels = { papel: "Papel comum", adesivo: "Adesivo", cartao: "Cartão / PVC" }`.
  - `finishings` via `listFinishings("impressao")` → options `{ value: f.name }` (sem grupo).
- Guardar em estado: `paperOptions`, `finishingOptions`.

## Mudanças no FormState
- Trocar `papel_inclui: string` → `papel_inclui: string[]`.
- Idem `papel_exclui`, `acabamentos_sugeridos`.
- Em `EMPTY`: arrays vazios.
- Em `openEdit`: usar diretamente `p.papel_inclui ?? []` (sem `.join`).
- Em `handleSave`: enviar arrays direto, remover helper `csv()` desses três campos (manter função se usada em outro lugar — não está).

## UI no diálogo (linhas 380–398)
Substituir os três `<Input>` por:
```tsx
<ChipMultiPicker
  label="Papel inclui"
  options={paperOptions}
  value={form.papel_inclui}
  onChange={(v) => setForm({ ...form, papel_inclui: v })}
  groupLabels={PAPER_GROUP_LABELS}
  emptyHint="Nenhum papel cadastrado"
/>
<ChipMultiPicker
  label="Papel exclui (opcional)"
  options={paperOptions}
  value={form.papel_exclui}
  onChange={(v) => setForm({ ...form, papel_exclui: v })}
  groupLabels={PAPER_GROUP_LABELS}
/>
<ChipMultiPicker
  label="Acabamentos sugeridos"
  options={finishingOptions}
  value={form.acabamentos_sugeridos}
  onChange={(v) => setForm({ ...form, acabamentos_sugeridos: v })}
  emptyHint="Cadastre acabamentos em Preço Impressão"
/>
```

## Compatibilidade com dados antigos
Os valores hoje salvos como texto livre podem não bater exatamente com `paper_type` cadastrado. Comportamento:
- Ao abrir um preset existente, qualquer valor em `papel_inclui` que não exista mais no catálogo aparece como chip **inativo** com badge "fora do catálogo" e botão `×` para remover. Isso evita perder dados silenciosamente.
- Ao salvar, mantém os valores como vieram (sem normalizar grafia automaticamente).

## Fora de escopo
- Não alterar o schema do banco (continua `text[]`).
- Não alterar a forma como `productSuggester.ts` consome `papel_inclui`/`acabamentos_sugeridos` — comparações já são case-insensitive.
- Não mexer em mídia (lona/adesivo/chapa) do bloco CV.
