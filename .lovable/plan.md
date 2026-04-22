

# Adicionar seleção de cor (consumível) ao registrar troca de toner

## Diagnóstico

A troca de 22/04 às 15:53 **está** no banco (`type='toner_change'`, `total_prints=7000`, `notes="Toner Ciano"`), mas com `consumable_id = NULL`. A Júlia, corretamente pelas regras vigentes, cai no fallback genérico e responde "baseado na última troca registrada sem especificar cor".

**Causa raiz:** o diálogo "Nova Leitura" em `PrinterReadingsTab.tsx` não tem seletor de consumível. Quando o operador escolhe tipo "Troca de Toner/Peça", não há como dizer **qual** toner foi trocado — então `consumable_id` nunca é preenchido e a infraestrutura nova fica inutilizada.

## O que muda

Arquivo único: `src/components/equipamentos/PrinterReadingsTab.tsx`. Sem alterar Edge Function, banco, auth ou demais telas.

### 1. Carregar consumíveis do equipamento
Adicionar um `useEffect` que busca `equipment_consumables` filtrados por `equipment_id` e armazena em estado local `consumables`. Filtrar apenas itens classificáveis como toner (nome contém "toner", excluindo revelador/cilindro/belt/fusor) — mesma lógica do helper da Edge Function — para não poluir o select com itens que não fazem sentido trocar.

### 2. Novo campo no formulário
No diálogo "Nova Leitura", adicionar um `Select` rotulado **"Consumível trocado"** que:
- **Aparece somente quando `type === "toner_change"`** (em outros tipos fica oculto).
- Lista os toners do equipamento por nome (ex.: "Toner Ciano", "Toner Magenta", "Toner Amarelo", "Toner Preto").
- Tem opção adicional **"Não especificar / genérico"** que mantém `consumable_id = null` (compatibilidade com fluxo atual).
- Quando o equipamento tem apenas 1 toner cadastrado, pré-seleciona automaticamente.

### 3. Persistir `consumable_id` no insert
No `handleSave`, incluir `consumable_id: selectedConsumableId || null` no payload do insert em `printer_readings`. Resetar o campo no fechamento do diálogo.

### 4. Mostrar a cor na tabela de leituras
Na coluna "Tipo" (ou em "Observações"), quando `type === "toner_change"` e `consumable_id` estiver preenchido, exibir o nome do consumível ao lado do badge ("Troca Toner/Peça — Ciano"). Isso dá feedback visual ao operador de que a cor foi registrada corretamente.

### 5. Validação leve
Se `type === "toner_change"` e o equipamento tem 2+ toners cadastrados, mostrar um aviso (não bloqueante) caso o operador deixe como "genérico", lembrando que a Júlia não conseguirá estimar por cor.

## Não muda
- Edge Function `assistente-virtual` (já lê e usa `consumable_id` corretamente)
- Migration / schema do banco (coluna já existe e é nullable)
- Fluxo de leituras "daily" (continua sem campo de consumível)
- `LeituraImpressoras.tsx` (página legada, fica para depois)

## Validação após deploy

1. Abrir Equipamentos → Xerox C70 → Contadores → Nova Leitura.
2. Selecionar tipo "Troca de Toner/Peça" → o campo "Consumível trocado" aparece com Ciano/Magenta/Amarelo/Preto + opção genérica.
3. Trocar Ciano → salvar → conferir no banco que `consumable_id` foi gravado.
4. Perguntar à Júlia *"quanto falta no toner ciano da C70?"* → resposta específica para ciano (com "Impressões desde troca deste toner: X"), sem o aviso de fallback genérico.
5. Perguntar sobre toner Magenta → estimativa diferente, baseada na última troca específica do magenta (ou fallback se nunca houve).

## Risco

Baixo. Mudança isolada em um componente, com valor padrão "genérico" preservando comportamento atual para quem não usar o seletor.

