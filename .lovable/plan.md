## Correção do Kit Encadernação — Mão de obra como total do lote + sincronia dinâmica

### Contexto rápido
A inserção da Mão de obra do Kit Encadernação está gravando o tempo bruto por apostila (`step.time_minutes`), mas a arquitetura `direct_sum` das apostilas exige que as linhas filhas representem o **total absoluto do lote**. Além disso, alterar `bookletUnits` depois de aplicar o Kit não recalcula o tempo (só os suprimentos).

### Mudanças

**1) `src/components/orcamentos-v2/SmartFinishingBlock.tsx` — `handleSuggestKit`**
- Voltar a multiplicar pelo número de apostilas ao criar cada `SubformLabor`:
  - `timeMinutes: (step.time_minutes || 0) * units`
- Anexar metadado `perBookletMinutes: step.time_minutes || 0` no objeto inserido (campo novo, opcional, usado pelo observer para recalcular proporcionalmente).
- Atualizar a descrição para incluir o sufixo `(×N apostilas)` (consistente com o helper `addLaborStep` já existente no mesmo arquivo).
- Remover o comentário antigo que justificava a não-multiplicação (linhas ~272-275).

**2) `src/components/orcamentos-v2/LaborAndSupplySubform.tsx`**
- Estender a interface `SubformLabor` com:
  - `perBookletMinutes?: number | null` — tempo bruto por apostila gravado no momento da inserção pelo Kit. Permanece opcional; itens manuais não usam.

**3) `src/components/orcamentos-v2/NewQuoteFormV2.tsx` — observer de `bookletUnits`**
No bloco que já sincroniza suprimentos quando `"bookletUnits" in patch` (≈ linhas 792-806), adicionar passo análogo para a mão de obra:
- Localizar o `setLabor`/equivalente (mesmo escopo do `setMaterials`).
- Para cada entrada com `parentItemId === id` e `perBookletMinutes != null`, atualizar `timeMinutes = perBookletMinutes * units`.
- Não tocar em entradas sem `perBookletMinutes` (mão de obra inserida manualmente preserva o valor digitado pelo usuário).

### Resultado esperado
- 10 apostilas × furação de 5 min → input preenchido com **50 min**.
- Trocar 10 → 20 apostilas → o campo passa para **100 min** automaticamente, junto com Capa/Contracapa/Mola que já reagem.
- Edição manual posterior do operador no input continua funcionando (o observer só recalcula quando `bookletUnits` muda).

### Fora de escopo
Engine de pricing, persistência no banco, RLS, edge functions, tipos gerados.
