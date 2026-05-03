## Objetivo

Reorganizar a página `/calculadora-etiquetas` em um layout mais limpo, com controles à esquerda e visualização compacta + ações à direita, eliminando elementos redundantes que confundem o uso diário (sempre SignMaster).

## Mudanças

### 1. Layout em 2 colunas com hierarquia clara
Arquivo: `src/components/labels/LabelLayoutCalculator.tsx`

Reestruturar o grid principal mantendo `lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]` (proporção mais equilibrada, hoje é 1fr/440px):

- **Coluna esquerda — Painel de controle** (tudo que o usuário ajusta):
  1. Faixa-resumo de configurações (folha + corte) — clique abre o dialog
  2. Tabs rápidas de folha (A4 / SRA3 / Formatão / Outro)
  3. Card "Simulador" (favoritos, formato, tamanho, quantidade, salvar favorito, imagem opcional)
  4. Card "Cálculo do orçamento" (Tipo Adesivo/Papel, Impressão, Acabamento) — pois é controle/seleção que determina o preço

- **Coluna direita — Visualização e ações** (output + o que copia/envia):
  1. Card "Aproveitamento" com preview SVG **menor** (reduzir `MAX` no `SheetPreview` de 320 para ~260 px) e os badges de cols×rows / aproveitamento
  2. Resultado financeiro (total, custo unitário, "X folhas × R$") — extraído do card de cálculo atual e mostrado como bloco compacto
  3. Card de Sugestões / Ancoragem (faixas)
  4. Bloco fixo de ações: **Copiar WhatsApp**, **Abrir WhatsApp**, **Copiar tabela WhatsApp**, **Gerar PDF de produção**, **Baixar faca .plt**
  5. Otimizadores ("cabem mais por folha" / "entregue maior") aparecem como Alerts compactos abaixo do preview, lado a lado em telas largas
  6. Aviso "quase cabe +1 coluna" (mantém)

Com isso, o usuário vê de um lado o que ele controla; do outro, o resultado e os botões de envio.

### 2. Remover slider manual de ajuste das marcas inferiores
Arquivo: `src/components/labels/LabelLayoutCalculator.tsx`

- Remover o bloco do `<Slider>` (linhas 1003-1025) e o estado `marksOffsetY` + `suggestedOffset` + `applySuggestedOffset`.
- A função `suggestMarksOffset` em `src/lib/labels/marks.ts` continua sendo usada internamente para posicionar as marcas automaticamente: o `SheetPreview` e `generateProductionPDF` passam a receber **sempre** o offset sugerido (em vez de zero/manual), garantindo que a marca de registro nunca fique sobre etiquetas.
- Atualizar a chamada de `handleGeneratePDF` para usar o offset calculado automaticamente.

### 3. Remover seletor de "Perfil de hardware"
Arquivos: `src/components/labels/LabelCalcSettingsDialog.tsx` e `src/lib/labels/config-storage.ts`

- Remover a seção "Perfil de hardware" do dialog de configurações (linhas 438-465).
- No `loadConfig`, forçar (migração silenciosa, padrão semelhante à migração de unidade já existente) `hardwareProfileId = "signmaster_param"` para todos os usuários.
- Manter `HARDWARE_PROFILES` no código (necessário para a spec paramétrica e PPR), apenas sem UI.

### 4. Mensagem informativa sobre SignMaster
Arquivo: `src/components/labels/LabelLayoutCalculator.tsx`

Adicionar um pequeno banner discreto (`Alert` ou texto auxiliar com ícone) próximo ao topo da coluna de visualização:

> "Parametrização baseada nas configurações do SignMaster (margens 7 mm, gap 3 mm, marcas L + T)."

Substitui o badge "SignMaster paramétrico · 7/7/7/7 · gap 3" atual por algo mais legível para humanos.

### 5. Ajustes finos de usabilidade
- Reduzir tamanho do `SheetPreview` (MAX 320 → 260) para que a visualização não domine a tela.
- Manter botão "Configurações" sempre visível no topo da coluna esquerda.
- Agrupar os botões de WhatsApp + PDF + .plt num único bloco "Enviar / Exportar" no final da coluna direita.

## Observações técnicas

- Nenhuma mudança em schema/banco — toda persistência continua em `localStorage`.
- O comportamento dos cálculos não muda (mesmo motor `computeSignmasterLayout`).
- Testes existentes (`signmaster-spec.test.ts`, `labels-layout.test.ts`) continuam válidos.
