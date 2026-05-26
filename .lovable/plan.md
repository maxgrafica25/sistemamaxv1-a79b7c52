# Padronizar botões de face nos presets

Hoje cada preset usa um estilo próprio para escolher Frente/F/V. O PrintForm/BookletForm/CustomCover já usam um **toggle segmentado pequeno** (chips numa linha, `h-8`, dentro de um wrapper `bg-muted/30 rounded-md p-0.5`). O Certificado e o Cartão ainda usam **cards grandes** (`rounded-lg border-2 p-3` com ícone + título + hint), o que destoa e ocupa muito espaço.

A decisão é **manter as 4 opções do Certificado**, só reduzir o tamanho, e alinhar o Cartão ao mesmo padrão visual já usado nos demais.

## Mudanças

### 1) `CertificateForm.tsx` — 4 chips compactos em uma linha
- Substituir o grid de cards grandes (`grid-cols-1 sm:grid-cols-2` com `rounded-lg border-2 p-3`) por uma **linha segmentada** com 4 chips do mesmo tamanho.
- Wrapper: `inline-flex w-full rounded-md border border-border bg-muted/30 p-0.5`.
- Cada chip: `flex-1 h-8 px-2 text-xs font-medium rounded-sm`, ícone Lucide pequeno (`h-3.5 w-3.5`) à esquerda + label curto.
- Labels curtos (com `title` para texto longo no hover):
  - **Frente** (FileText)
  - **F/V** (Files)
  - **F color + V PB** (FileText) — desabilitado se não houver PB
  - **F/V PB** (FileMinus) — desabilitado se não houver PB
- Estado ativo: `bg-background text-foreground shadow-sm ring-1 ring-border` (mesmo visual do `ModeButton` já existente em `shared/ModeButton.tsx`).
- Desabilitado: `opacity-50 cursor-not-allowed` + `title` explicando "Cadastre Couchê 210g A4 PB".
- Em telas estreitas (`< sm`), os chips quebram para `grid-cols-2` mantendo o mesmo tamanho de chip.
- Mantém toda a lógica atual (`FaceKey`, fallback automático quando `!hasPb`, pricing mix etc.) — só muda a apresentação.

### 2) `BusinessCardForm.tsx` — alinhar ao padrão Frente | F/V do PrintForm
- Substituir o `grid-cols-2 gap-3` de cards grandes (linhas ~383–420) pelo **mesmo wrapper segmentado** do PrintForm/BookletForm.
- 2 chips: **Frente** | **F/V** com o mesmo tamanho/altura/estilo do Certificado acima (consistência total entre presets).
- Label do campo: manter "Face de impressão" para não confundir com a lógica de poses do cartão.
- Nenhuma mudança em pricing, layout da folha, ou cálculo de poses.

### 3) Varredura dos demais presets
Já verificado via `rg`:
- `PrintForm`, `BookletForm`, `CustomCoverEditor` → já estão no padrão segmentado (feito nas rodadas anteriores). Sem mudança.
- `LabelEmbeddedForm` → sempre uma face só, não tem seletor. Sem mudança.
- Outros forms não têm seletor de face. Sem mudança.

## Detalhes técnicos

- **Nenhuma mudança de lógica/preços/schema.** Apenas substituição de markup nos dois arquivos.
- Reaproveitar visual do componente já existente `src/components/orcamentos-v3/shared/ModeButton.tsx` como referência de estilo (mesmas classes do estado ativo). Não vou extrair um componente novo agora — inline mantém a mudança mínima e consistente com como PrintForm/BookletForm fizeram.
- Ícones e imports continuam os mesmos (`FileText`, `Files`, `FileMinus`, `Check` deixa de ser necessário no Certificado/Cartão para essa seção).
- O bloco de aviso "PB não cadastrado" some do hint visível e passa para `title` (tooltip nativo) no chip desabilitado, já que não cabe mais como subtítulo.

## Fora de escopo
- Não alterar `useV3Catalog`, `pricing.ts`, `quote_presets`, schema ou cálculos.
- Não mexer em `PrintForm`, `BookletForm`, `CustomCoverEditor` (já padronizados).
- Não criar componente compartilhado novo — fica como possível refator futuro se aparecer um 4º preset com seletor.
