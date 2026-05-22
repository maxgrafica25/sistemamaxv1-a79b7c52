# Melhorar UX das faixas de quantidade

## Problema

Hoje, em Impressão, Etiqueta, Terceiros e Suprimento, comparar quantidades exige clicar no botão **Comparar faixas** que abre um popover. O usuário não vê as faixas a menos que descubra o botão — fluxo escondido e pouco intuitivo.

Os formulários de **Comunicação Visual** e **Apostila** já usam o painel inline `TierFaixasPanel`, que mostra as faixas direto na tela, junto da quantidade principal. O resultado é muito mais fluido.

## Solução

Padronizar todos os formulários para o painel inline.

### Mudanças por arquivo

1. **`PrintForm.tsx`**
   - Remover `TierSimulator` do lado direito do campo "Quantidade (folhas)".
   - Logo abaixo do bloco "Quantidade + Preço unitário", renderizar `<TierFaixasPanel>` (quando `onAddTiers` existir), recebendo `compute(qty)` igual ao atual.
   - Adicionar estado `extraTiers` + `onExtrasChange={setExtraTiers}`.
   - No `submit()`, se houver `extraTiers`, chamar `submitAsTiers([quantidade, ...extras], quantidade)` em vez do `onAdd` simples — mesma lógica de `CVForm`.
   - Atualizar o label do botão "Adicionar" para "Adicionar + N faixa(s)" quando houver extras.

2. **`LabelEmbeddedForm.tsx`** — mesma transformação.

3. **`ThirdPartyForm.tsx`** — mesma transformação.

4. **`SupplyForm.tsx`** — mesma transformação.

5. **`TierSimulator.tsx`** — deletar, já não terá usos.

### Detalhes técnicos

- `TierFaixasPanel` já existe e já suporta `onExtrasChange`, atalhos (−5/+5/+10/+15), campo livre, persistência em localStorage, e estado "desabilitado" quando o form está incompleto.
- O painel mostra a quantidade atual destacada como "Solicitada" + lista de sugestões — não é mais necessário um botão "Usar esta quantidade" (o input principal continua sendo a fonte da quantidade solicitada).
- O botão final "Adicionar ao orçamento" passa a refletir quantas faixas serão criadas, igual ao `BookletForm` já faz.

## Validação

- `/orcamentos-v3/novo` → Impressão: as faixas aparecem inline abaixo de Quantidade, sem necessidade de abrir popover.
- Mesmo comportamento em Etiqueta, Terceiros e Suprimento.
- Selecionar atalhos (+5, +10…) atualiza a lista e o botão "Adicionar" mostra contagem de faixas.
- Ao adicionar, todas as faixas entram como um grupo no carrinho, com a quantidade do input principal como "tier_primary".
