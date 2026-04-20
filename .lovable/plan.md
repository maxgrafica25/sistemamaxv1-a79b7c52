

# Corrigir extração de fornecedores no `NovoSiteDialog`

Dois problemas reais quando o usuário cola múltiplas URLs:

1. **URL com 0 tiers some sem aviso** → parece que "só 1 fornecedor foi salvo".
2. **Nome do fornecedor é gerado automaticamente do domínio** (`atualcard.com.br` → "Atualcard") e não pode ser corrigido antes de salvar.

## Mudanças em `src/components/monitoramento/NovoSiteDialog.tsx`

### 1) Mostrar e permitir editar o fornecedor por URL

Adicionar estado `fornecedorOverrides: Record<string, string>` (chave = `source_url`).

Para cada URL no resultado, mostrar um campo `Input` com o nome detectado, editável:

```text
[ ✓ ] https://www.atualcard.com.br/...     [strategy: html]
      Fornecedor: [ Atual Card          ]   ← editável
      (tabela de tiers)
```

Detecção inicial usa um **dicionário de domínios conhecidos** (Atual Card, Imprima Rápido, ANS, Futuraim, Gráfica do Site, etc.) com fallback para o atual `extractDomainName`. Dicionário pequeno (~10 entradas), mantido inline no arquivo:

```ts
const KNOWN_SUPPLIERS: Record<string, string> = {
  "atualcard.com.br": "Atual Card",
  "imprimarapido.com.br": "Imprima Rápido",
  "ans.com.br": "ANS",
  "futuraim.com.br": "Futura IM",
  "graficadosite.com.br": "Gráfica do Site",
  // ...
};
```

Função `detectSupplier(url)`: tenta `KNOWN_SUPPLIERS` por hostname (sem `www.`), senão cai no `extractDomainName` atual.

Quando `results` muda, prepopular `fornecedorOverrides[url]` com o detectado, sem sobrescrever o que o usuário já editou.

### 2) Mostrar URLs com 0 tiers de forma clara

Hoje elas aparecem (com badge vermelho), mas o **botão Salvar ignora silenciosamente**. Mudanças:

- Adicionar contador no botão: `"Salvar 1 / 2 URLs (1 sem tiers será ignorada)"`.
- Acima da lista de resultados, banner de resumo: `"2 URLs testadas: 1 com tiers (Futuraim), 1 sem tiers (Atual Card — Nenhum tier encontrado)"`.
- No card vermelho da URL falha, manter a mensagem de erro já existente, mas destacar visualmente com borda destrutiva.

### 3) Usar o fornecedor editado ao salvar

Em `handleSave`, trocar:

```ts
const fornecedor = extractDomainName(r.source_url);
```

por:

```ts
const fornecedor = (fornecedorOverrides[r.source_url] || detectSupplier(r.source_url)).trim() || null;
```

Resto do insert fica igual.

### 4) Toast final mais informativo

Já existe `created/skipped/failed`. Adicionar `not_scraped` (URLs sem tiers que foram ignoradas):

`"1 criado · 1 sem tiers ignorado"` em vez do atual silêncio.

## Arquivo afetado

| Ação | Arquivo |
|------|---------|
| Editar | `src/components/monitoramento/NovoSiteDialog.tsx` |

## Não muda

- Edge function `scrape-prices` — está funcionando, problema é só na UI.
- Schema do banco.
- `Monitoramento.tsx`.

## Resultado esperado

- Ao colar 2 URLs e testar, o usuário vê os 2 resultados, **edita o nome do fornecedor** se quiser (já vem detectado bonito para sites conhecidos), e ao salvar fica claro quantos foram salvos e quantos foram ignorados por falta de tiers.
- Para o caso atual (Atual Card 0 tiers), o usuário vai ver explicitamente "Atual Card — Nenhum tier encontrado" e poder decidir o que fazer (corrigir URL, ou ignorar).

