## Objetivo
No Kit Encadernação da Apostila, permitir escolher entre **Capa padrão** (suprimento pronto: PP Line, Cristal, etc.) ou **Capa personalizada** (impressão própria, ex.: Couchê 300g + laminação), com troca por linha mantendo o resto do Kit editável.

## 1. Seletor de modo da Capa

Na linha "Capa" do `BookletKitPanel`, antes do select de item, um toggle compacto:

```
Capa:  ( • Padrão  ○ Personalizada )
```

### Modo Padrão (default — comportamento atual + troca)
- Select com suprimentos categoria "capa" (PP Line Incolor, Cristal, etc.).
- Quantidade = 1 por apostila (regra atual de `buildBookletKit`).
- Mesmo comportamento para Contracapa.

### Modo Personalizada (novo)
Bloco inline com 3 campos:

| Campo | Origem |
|---|---|
| Papel | Select de `papers` (sugere Couchê 300g por padrão) |
| Formato | A4 / A3 / SRA3 (sugere A4) |
| Impressão | Frente / Frente e Verso |
| Acabamento | Multi-select de acabamentos compatíveis com capa (Laminação BOPP fosca/brilhante, Verniz, etc.) — opcional |

- Gera **uma linha de impressão** (V3Item tipo "print") usando o motor de preço existente (mesmos multiplicadores A3/SRA3 e F/V).
- Gera **uma linha por acabamento** escolhido (reusa `PrintForm`/catálogo de finishings recém-ajustado).
- Quantidade = quantidade de apostilas do orçamento.
- Sugestão default ao ativar: **Couchê 300g + A4 + Frente + Laminação BOPP brilhante** (só sugestão, tudo editável).

Mesmo toggle e bloco disponíveis para **Contracapa** (mesma mecânica).

## 2. Estado e persistência

Estado local no painel:
```ts
coverMode: 'standard' | 'custom'
customCover: { paperId, format, sides, finishingIds[] } | null
// idem para backCover
```

Ao clicar **"Aplicar Kit"**:
- Modo padrão → V3Item de suprimento (como hoje).
- Modo personalizado → V3Item de impressão + N V3Items de acabamento, todos marcados com `kitSlot: 'cover'` para permitir remover/recompor.

## 3. UI

- Toggle estilo `Tabs` pequeno (shadcn) dentro da linha da capa, não abre modal.
- Quando "Personalizada" ativo, a linha expande verticalmente mostrando os 4 campos em grid compacto.
- Badge "sugerido" continua aparecendo ao lado dos defaults.
- Subtotal da linha mostra a soma (impressão + acabamentos) em modo personalizado.

## 4. Arquivos

- `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` — toggle, bloco de capa personalizada, estado.
- `src/components/orcamentos-v3/forms/CustomCoverEditor.tsx` (novo) — componente reutilizado por capa e contracapa.
- `src/lib/bookletKit.ts` — `buildBookletKit` aceita `coverOverride` / `backCoverOverride` retornando array de V3Items (impressão + acabamentos) quando custom.
- Sem migrations. Sem mudança em motor de preço, multiplicadores ou catálogo de finishings.

## Fora de escopo

- Salvar "capa personalizada" como preset reutilizável (pode virar feature futura).
- Trocar quantidade/tempo manualmente das outras linhas do Kit (mantém o que ficou acordado: só trocar item por categoria).
- Outros formulários (Cartão, Folheto, Etiqueta) e Resumo Financeiro.
