## Título do item: só quantidade + nome, com plural

### Regra do título (linha 1)

`{qty} un. - {Nome do produto}` — e o **Nome** vira plural quando `qty > 1`.

- Exemplos: `1 un. - Apostila` · `5 un. - Apostilas` · `100 un. - Etiquetas` · `1 un. - Impresso personalizado` · `200 un. - Impressos personalizados`.
- A linha 2 (subtítulo cinza) já tem as características (folhas, papel, F/V, dimensões) — o título **nunca** repete esses dados.

### Como decidir o "Nome do produto"

Prioridade, no helper `itemTitle()` em `UnifiedCart.tsx`:

1. **Preset/produto nomeado** — se o item tem `bundle_label` ou um nome de preset (ex.: kit Apostila, Etiqueta, Cartão de Visita), usa esse nome.
2. **Descrição digitada pelo usuário** — se ele preencheu o campo "Descrição (opcional)", usa o que foi digitado.
3. **Fallback padrão por tipo** — quando nada acima existe:
   - `print` → `Impresso personalizado`
   - `booklet` → `Apostila`
   - `label` → `Etiqueta`
   - `cv` → `Comunicação visual`
   - `third` → `Serviço terceirizado`
   - `supply` → `Suprimento`
   - `labor` → `Mão-de-obra` (sempre singular)

### Pluralização

Novo helper `pluralizePt(name, qty)` em `UnifiedCart.tsx`, aplicado à última palavra do nome:

- termina em vogal/`n` → `+s` (Apostila → Apostilas; Impresso → Impressos)
- termina em `m` → troca por `ns` (Item → Itens; Bom → Bons)
- termina em `r`, `s`, `z` → `+es` (Cartaz → Cartazes); palavras já no plural ficam como estão
- termina em `ão` → `ões` (regra mais comum; aceita-se imperfeição em casos raros)
- termina em `l` → troca por `is` (Painel → Painéis — sem acento adicional)
- adjetivos colados ("Impresso personalizado") → flexiona também o adjetivo final quando termina em vogal (`personalizado → personalizados`).

Para nomes digitados pelo usuário com várias palavras, pluraliza apenas o substantivo principal (primeira palavra) + adjetivo final, deixando o miolo intacto. Casos exóticos seguem a regra simples (aceita imperfeição — é uma melhoria cosmética, não validação).

### Onde aplicar (escopo)

Apenas em `src/components/orcamentos-v3/cart/UnifiedCart.tsx`:

1. Novo helper `pluralizePt(name: string, qty: number): string`.
2. Novo helper `defaultName(kind: V3Item["kind"]): string` com a tabela de fallback acima.
3. Atualizar `itemTitle(it)` para usar a prioridade descrita e aplicar `pluralizePt`.
4. Usar `itemTitle` em **SingleCard**, **Group/Tier card** e **BundleCard** (já é o caso; apenas a lógica interna muda).

Nenhuma mudança em forms, tipos, persistência ou pricing. O subtítulo (`itemSubtitle`) permanece exatamente como está.