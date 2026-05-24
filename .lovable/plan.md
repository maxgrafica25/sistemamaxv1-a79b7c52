# Rótulo do seletor de substrato no Print

Trocar o rótulo "Item do catálogo" do `PrintForm` por algo intuitivo para o produto selecionado: padrão **"Papel"**, e **"Cartão PVC"** quando o produto for Crachá.

## Onde

- `src/components/orcamentos-v3/forms/PrintForm.tsx` — aceitar prop `substrateLabel?: string` (default `"Papel"`) e usá-la no `<Field label=...>` e no placeholder.
- `src/components/orcamentos-v3/forms/PrintAndProductForm.tsx` — calcular o rótulo a partir do nome do preset selecionado e repassar nas três montagens do `PrintForm`.

## Regra do rótulo (PrintAndProductForm)

```
nome do preset (case/acento-insensitive) contém "crach" → "Cartão PVC"
caso contrário → "Papel"
```

## Detalhes de UI

- `Field label`: usa `substrateLabel` (ex.: "Papel" ou "Cartão PVC").
- Placeholder do `Input` de descrição quando ainda não há `catalog`: muda de "Selecione o item primeiro" para "Selecione o {substrateLabel.toLowerCase()} primeiro".

## Fora do escopo

- BookletForm ("Miolo (papel do catálogo)") — apostila sempre é papel.
- LabelEmbeddedForm, BusinessCardForm, CVForm — fluxos diferentes.
- `PrintingItemSearch` (placeholder interno de busca) — mantém o texto atual; mudar lá afeta outros usos.
