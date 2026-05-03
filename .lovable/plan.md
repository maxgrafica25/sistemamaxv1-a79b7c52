## Mover seletores de Impressão/Acabamento para o topo

Hoje os seletores de **Tipo (Adesivo/Papel)**, **Impressão** e **Acabamento** vivem dentro do card "Cálculo do orçamento" (coluna direita). O pedido é movê-los para a **coluna esquerda (painel de controle)** e deixar o card de orçamento apenas com o resultado (quantidade × folhas × total + custo unitário + botões de copiar/WhatsApp/PDF).

### Alterações em `src/components/labels/LabelLayoutCalculator.tsx`

1. **Novo card "Materiais e acabamento" na coluna esquerda**, posicionado logo após o card "Tipo de corte" (antes do card "Simulador"). Conteúdo exatamente igual ao atual bloco "Composição do preço da folha" (linhas ~1247–1339), mantendo:
   - Toggle Adesivo/Papel (oculto quando `cutMode === "guilhotina"` — conforme já decidido).
   - Select de **Impressão (Tabela de Preços)** com link "Cadastrar agora →" se vazio.
   - Select de **Acabamento (Recorte / outros)** com badge "auto" e link "Editar acabamentos →".
   - Linha "Total por folha: R$ …" preservada como rodapé do card (referência rápida).

2. **Limpar o card "Cálculo do orçamento"** (coluna direita): remover o bloco "Composição do preço da folha" inteiro. O card passa a conter apenas:
   - Cabeçalho com link "Editar tabelas".
   - Linha-resumo `qty un ÷ perSheet/folha = N folhas × R$ X = R$ Total` e custo unitário.
   - Mensagem de fallback quando faltam dados.
   - `ProductionTimeCard` (PPR).
   - Botões: Copiar WhatsApp, Abrir WhatsApp, Gerar PDF, Baixar .plt (quando aplicável), Usar N folhas no orçamento.

3. **Sem mudanças** em `useFolhaPricing`, lógica de pricing, ladder de ancoragem, geração de PDF/WhatsApp ou no card "Aproveitamento".

### Resultado visual

```text
COLUNA ESQUERDA                  COLUNA DIREITA
┌──────────────────────────┐    ┌─────────────────────────┐
│ Tipo de corte            │    │ [Banner SignMaster/Guil]│
├──────────────────────────┤    ├─────────────────────────┤
│ Materiais e acabamento   │    │ Aproveitamento + Preview│
│  • Tipo (Ades/Papel)     │    ├─────────────────────────┤
│  • Impressão  [select]   │    │ Sugestões shrink/grow   │
│  • Acabamento [select]   │    ├─────────────────────────┤
│  Total/folha: R$ …       │    │ Cálculo do orçamento    │
├──────────────────────────┤    │  qty ÷ /folha = …       │
│ Simulador (medidas/qtd)  │    │  R$ TOTAL  · R$/un      │
│ + Imagem opcional        │    │  [Copiar][Abrir Whats]  │
└──────────────────────────┘    │  [Gerar PDF][.plt]      │
                                └─────────────────────────┘
```

### Fora de escopo
Layout em 2 colunas, paleta, hooks de pricing e qualquer texto de Plotter/Guilhotina não citado aqui.
