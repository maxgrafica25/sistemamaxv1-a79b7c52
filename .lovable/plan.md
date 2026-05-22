## Diagnóstico

O sistema de presets ontem foi implementado **só do lado admin**: existe a tabela `quote_presets` populada com 9 presets e a página `/presets-orcamento` para gerenciar. O que **não existe** é o atalho do ponto de vista de quem está orçando: depois de configurar um item personalizado (papel + tamanho + acabamentos no módulo Impressão, ou largura/altura/mídia no módulo CV), **não há botão "Salvar como preset"** dentro do formulário do orçamento. É isso que vamos adicionar.

## Mudanças propostas

### 1. Backend — permissão para salvar preset (migração)

Hoje só admin pode inserir em `quote_presets`. Para a UX pedida funcionar para qualquer colaborador, vamos liberar INSERT para qualquer usuário autenticado. UPDATE e DELETE seguem restritos a admin (gestão continua centralizada).

```sql
DROP POLICY "Admins can insert quote_presets" ON public.quote_presets;
CREATE POLICY "Authenticated can insert quote_presets"
  ON public.quote_presets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
```

### 2. Hook `useQuotePresets` — expor `reload()`

`src/components/orcamentos-v3/shared/useQuotePresets.ts`: extrair o fetch para função, devolver `reload` junto com `presets` e `loading`, para que após salvar um novo preset a lista de chips atualize sem reload de página.

### 3. Novo componente `SavePresetDialog.tsx`

`src/components/orcamentos-v3/shared/SavePresetDialog.tsx` — diálogo enxuto com:
- Campo **Nome** (obrigatório).
- Select de **Ícone** (reusa `PRESET_ICONS`/`PRESET_ICON_NAMES`).
- Preview com os atributos que serão salvos (papel, tamanho, qtd, acabamentos ou largura×altura/mídia, conforme o módulo).
- Botões Cancelar / Salvar preset.
- Recebe um `payload: Partial<QuotePresetInsert>` já montado pelo formulário pai e faz o `supabase.from('quote_presets').insert(...)`.
- Toast de sucesso + `onSaved()` callback para o pai chamar `reload()` do hook.

### 4. Botão "Salvar como preset" no módulo Impressão

`src/components/orcamentos-v3/forms/PrintAndProductForm.tsx`:
- Captura a seleção atual via o `onSelectionChange` que o `PrintForm` já dispara (paper_type, size, grammage, finishings).
- Renderiza, quando `mode === "custom"` e existe `paper_type`, um botão discreto **"⭐ Salvar como preset"** ao lado/abaixo do toggle Produtos|Personalizado.
- Ao clicar, abre `SavePresetDialog` com payload:
  - `modulo: "impressao"`
  - `form_tipo: "print"` (definido a partir do sub-form ativo; no caso atual sempre `PrintForm` no modo custom)
  - `papel_inclui: [paper_type]` (lowercase, trimmed)
  - `acabamentos_sugeridos: finishings` (já vêm como ids em snake_case)
  - `quantidade_padrao`: opcional, vamos enviar `null` por padrão (a "qtd" do item personalizado não é necessariamente a "qtd padrão" do preset). Marcar isso no preview com checkbox "incluir quantidade padrão (X)" — desmarcado por padrão.
  - `nome`, `icone`: do diálogo.

### 5. Botão "Salvar como preset" no módulo Comunicação Visual

`src/components/orcamentos-v3/forms/CVForm.tsx`:
- O state já está no próprio `CVForm` (largura, altura, quantidade, midiaId, isBanner). Mais simples.
- Botão renderizado quando `mode === "custom"` e existe `midia` selecionada.
- Payload:
  - `modulo: "cv"`
  - `largura_cm`, `altura_cm`: do form
  - `is_banner`: do toggle
  - `midia_tipo`: `midia.tipo_midia` quando bater com enum suportado (`lona|adesivo|chapa`), senão `null`
  - `midia_nome_match`: trecho do `midia.nome` (vamos sugerir as 2 primeiras palavras, editável no diálogo)
  - `quantidade_padrao`: opcional (mesmo checkbox)
  - `nome`, `icone`: do diálogo.

### 6. Refresh dos chips

Após salvar com sucesso, chamar `reload()` do `useQuotePresets` no formulário pai (`PrintAndProductForm` ou `CVForm`) para que o novo chip apareça imediatamente.

## Fora de escopo

- Não vamos editar/excluir presets a partir do formulário de orçamento (continua na página admin).
- Não vamos mudar a UI da página `/presets-orcamento`.
- Não vamos mexer no módulo Terceirizados (não tem presets).
- Não vamos adicionar novos campos à tabela `quote_presets` — usamos o schema existente.

## Validação

Em `/orcamentos-v3/novo`:
1. Aba Impressão → Personalizado → escolher um papel + acabamentos → clicar "Salvar como preset" → digitar "Meu Folder" → confirma → toast → aparece novo chip "Meu Folder" no modo Produtos.
2. Aba Com. Visual → Personalizado → ajustar largura/altura/mídia → "Salvar como preset" → idem.
3. Logar como colaborador não-admin: também consegue salvar (após migração de RLS).
4. Página `/presets-orcamento` continua mostrando o novo preset e permite editar/excluir (apenas admin).
