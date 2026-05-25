## Contexto

A última implementação adicionou o seletor **"Lado de impressão: Frente | F/V"** antes do papel apenas no `PrintForm` (usado pelo modo Personalizado e por presets do tipo `print`). Os demais formulários que também têm escolha de papel continuam com o padrão antigo (`Switch` "Duplex/Frente e Verso") e sem filtro no catálogo.

## Escopo: padronizar os presets restantes

Aplicar o mesmo padrão visual + comportamento (toggle segmentado **Frente | F/V** acima do campo de busca de papel, com filtragem do catálogo) em:

### 1. `BookletForm.tsx` — Miolo da apostila
- Substituir `const [duplex, setDuplex] = useState(true)` por `const [sideChoice, setSideChoice] = useState<"Frente"|"F/V">("F/V")` (apostila geralmente é F/V).
- Adicionar o toggle segmentado acima do `PrintingItemSearch` do miolo, no mesmo estilo do `PrintForm`.
- Passar `items` filtrados: quando `sideChoice === "Frente"`, ocultar itens `side === "F/V"`.
- Quando trocar para "Frente" e o catálogo atual for F/V, resetar `setCatalog(null)`.
- Manter o `Switch` "Duplex (F/V)" pós-seleção **removido** (o toggle pós-seleção segue o mesmo padrão do PrintForm — segmentado), e toda a lógica de `sideMult`, `physicalSheets`, `totalMioloPreco` continua intacta lendo `sideChoice` no lugar de `duplex`.

### 2. `CustomCoverEditor.tsx` — Capas personalizadas da apostila
- Substituir `const [duplex, setDuplex] = useState(false)` por `sideChoice`.
- Adicionar o toggle segmentado acima do `PrintingItemSearch` da capa.
- Filtrar `items` por `sideChoice` antes de passar ao search.
- Trocar o `Switch` "Frente e Verso" atual pelo mesmo toggle segmentado (consistência visual), mantendo `sheetsPerUnit`, `face` e todos os cálculos lendo `sideChoice`.

### Fora de escopo (mantém UI atual)
- **`BusinessCardForm`** — UI dedicada de poses (frente/verso por pose), não cabe binário.
- **`CertificateForm`** — 4 modos exclusivos, não cabe binário.
- **`LabelEmbeddedForm`** — etiquetas sempre só-frente; sem alternância.
- **Capa única do `BookletForm`** (se houver Switch separado) — segue a mesma troca por toggle segmentado se existir.
- `pricing.ts`, `useV3Catalog`, schema, `quote_presets`.

## Resultado esperado

Após a implementação, todo formulário que escolhe papel mostra primeiro o seletor **Lado de impressão: Frente | F/V**, filtra o catálogo coerentemente, e o toggle pós-seleção tem o mesmo visual segmentado roxo do `PrintForm`.