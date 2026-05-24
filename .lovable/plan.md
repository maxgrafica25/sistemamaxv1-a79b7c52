# Renomear Presets → Produtos Favoritos + título da seção + remover Desfavoritar

## Contexto
No `/orcamentos-v3/novo`, dentro do `PrintAndProductForm`, os chips de presets aparecem soltos, sem título, e ainda existe o botão "Desfavoritar" — redundante, já que a página `/presets-orcamento` permite excluir. A memória do projeto já usa o termo **"Produtos Favoritos"** (ver Kit ↔ Produtos Favoritos), então adotamos esse nome de forma consistente.

## Mudanças

### 1. `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`
- Acima da linha de chips (linha ~200), adicionar um cabeçalho:
  ```
  <Label>Produtos favoritos</Label>
  <p className="text-xs text-muted-foreground">
    Atalhos rápidos com combinações salvas. Escolha um ou use "Personalizado".
  </p>
  ```
- Remover o bloco `{selectedPreset && (<Button ... Desfavoritar />)}` (linhas 262–274) e o `<AlertDialog>` de confirmação de desfavoritar (linhas 285+ até o fechamento).
- Remover estado `presetToDelete`, callback de exclusão (linhas ~71, 88–103) e imports não usados (`Trash2`, `AlertDialog*`).
- Manter botão "Salvar como favorito".

### 2. `src/pages/QuotePresets.tsx`
- Trocar título "Presets de Orçamento" → "Produtos Favoritos" (linha 189) e ajustar textos/descritivos da página para "favoritos" em vez de "presets".

### 3. `src/components/Sidebar.tsx`
- Linha 77: trocar `name: "Presets de Orçamento"` por `name: "Produtos Favoritos"`. Rota `/presets-orcamento` permanece (sem quebrar links existentes).

## Fora de escopo
- Renomear tabela `quote_presets` no banco, identificadores internos, ou a rota da URL.
- Alterar lógica de salvar/carregar favoritos.
- Mexer em `LabelPresets` da calculadora de etiquetas (contexto diferente).
