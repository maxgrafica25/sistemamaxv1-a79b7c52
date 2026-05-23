## Diagnóstico

Suas 2 etapas e 1 grupo existem no banco, mas estão no **plural** ("Cartões de visita") enquanto o filtro busca pelo singular ("cartao de visita"). Por isso nada aparece. Em vez de "consertar" o filtro por nome (frágil), vamos criar um **vínculo explícito** entre cada favorito (Cartão de Visita, Folheto, Apostila, Etiqueta, Adesivo, Certificado) e as etapas/grupos que devem aparecer como acabamentos.

## O que será feito

### 1. Banco — nova tabela de vínculos
Tabela `product_preset_processes` com:
- `preset_key` (texto: `business_card`, `flyer`, `booklet`, `label`, `sticker`, `certificate`)
- `step_id` (nullable, FK production_steps) OU
- `group_id` (nullable, FK step_groups)
- `sort_order`
- RLS: leitura para autenticados, escrita só admin.

Restrição: exatamente um de `step_id`/`group_id` preenchido.

### 2. Tela de gestão dos vínculos
Em **Processos de Produção**, adicionar uma aba ou seção "**Vincular a Favoritos do Orçamento**" onde, para cada favorito (Cartão de Visita, Folheto, etc.), o admin escolhe via multi-select quais etapas e grupos aparecem como chip de acabamento.

### 3. Carregar vínculos no formulário
Novo hook `useProductPresetProcesses(presetKey)` que retorna `{steps, groups}` já filtrados pelos vínculos cadastrados.

`BusinessCardForm` passa a usar `useProductPresetProcesses("business_card")` em vez do filtro por nome. Mantém o `procCost(minutes)` e o fallback de `time_minutes`.

Fallback (quando não há nenhum vínculo cadastrado): mostra mensagem "Cadastre vínculos em /processos-producao" com link.

### 4. UX — `BusinessCardForm.tsx`
- **Quantidade**: inicia vazia (`qtdCartoes` como `null`/`""` em vez de `1000`); placeholder "Ex: 1000". Cálculo de folhas/preço só roda se `> 0`.
- **Face Frente / Frente e Verso**: substituir os dois botões compactos por **2 cards selecionáveis** lado a lado, com ícone (página única vs página dupla), título grande e legenda curta ("1 face de impressão" / "2 faces · custo ~2x"). Estado selecionado com borda primary + check.

## Fora de escopo

- Outros formulários (Folheto, Apostila, etc.) ganham os vínculos automaticamente quando passarmos a usar `useProductPresetProcesses`, mas neste plano só `BusinessCardForm` é convertido. Os demais ficam para depois.
- Não mexer em `useV3ProcessCatalog` (continua sendo usado em outros lugares).

## Validação

1. Após migração, abrir Processos de Produção → vincular as 2 etapas + 1 grupo ao favorito "Cartão de Visita".
2. Abrir `/orcamentos-v3/novo` → Cartão de Visita: campo quantidade vazio, face em cards, chips de acabamento aparecem listando as 2 etapas e o grupo com tempo/custo.
3. Selecionar chip → preço total atualiza.
