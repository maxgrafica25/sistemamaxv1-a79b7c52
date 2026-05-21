## Apostila: sugerir kit de encadernação por padrão

### Diagnóstico

O `BookletForm` já carrega `ProductKitPanel` (genérico, lê de `product_kits` no banco). Hoje a tabela `product_kits` está **vazia** para `product_kind = 'apostila'`, então o painel chama `return null` e o usuário não vê sugestão nenhuma — só a frase "Use o Kit Encadernação abaixo…" sem o "abaixo" existir.

Mas o código já tem tudo o que falta: `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` + `shared/bookletKit.ts` montam, sem precisar de banco, um kit padrão com:

- Capa frontal (regex match em supplies → fallback "Capa PP Line A4 Incolor — preencher")
- Contracapa (fallback "Capa PP Camurça A4 Preta — preencher")
- Espiral do diâmetro sugerido por `getIdealSpiral(folhas)`
- Furação (mão-de-obra)
- Encadernação (mão-de-obra)

Cada linha tem checkbox para incluir/excluir, e o "Aplicar Kit" empurra os V3Items para o carrinho — exatamente o "sugerir + alterar com facilidade" que o usuário pediu.

### Mudança

`src/components/orcamentos-v3/forms/BookletForm.tsx` — trocar o `<ProductKitPanel productKind="apostila" …>` por uma combinação:

1. **Sempre** renderizar `<BookletKitPanel>` (sugestão automática, zero config no banco). É o caminho default.
2. **Adicionalmente**, manter `<ProductKitPanel>` para o caso de o usuário cadastrar kits customizados em `product_kits` (ele já se auto-esconde quando não há) — fica abaixo do BookletKitPanel como "Outros kits cadastrados".

Ordem visual (mantém "Use o Kit Encadernação abaixo" coerente):

```
[ Resumo do miolo ]
   ↓
[ BookletKitPanel ]   ← sempre presente, sugestão pronta
   ↓
[ ProductKitPanel ]   ← só aparece se houver kit customizado em DB
   ↓
[ Descrição ]
[ Adicionar apostila ]
```

### Detalhes

- `BookletKitPanel` já existe e foi descomissionado em favor do `ProductKitPanel`. Vou reativar sem mudanças funcionais.
- Renderização condicionada a `canAdd && bookletPages > 0 && bookletUnits > 0` (igual hoje).
- Texto do rodapé do resumo do miolo permanece — agora aponta para algo de verdade.
- Microcopy do header do BookletKitPanel: alterar de "Kit Encadernação" para "Kit sugerido · Encadernação" para deixar claro que é sugestão (consistente com a frase do resumo).

### Fora de escopo

- Não vou criar migration para popular `product_kits` (o caminho default já não depende mais disso).
- Não vou mexer no `BookletKitPanel` em si — ele está pronto.
- Não toco em `CartãoVisita`, `Folheto`, `Etiqueta` — outros forms seguem usando `ProductKitPanel` como hoje.

### Risco

Mínimo. Estou desfazendo uma regressão (o panel já existia, foi escondido por uma camada genérica que ficou sem dados). Sem mudança de cálculo, sem migration, sem nova dependência.

### Arquivos

- `src/components/orcamentos-v3/forms/BookletForm.tsx` — adicionar `BookletKitPanel` antes do `ProductKitPanel`
- `src/components/orcamentos-v3/forms/BookletKitPanel.tsx` — só ajuste de microcopy do header
