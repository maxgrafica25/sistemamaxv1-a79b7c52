
## Diagnóstico

O Firecrawl + LLM está alucinando os tiers do Atual Card. A página real tem quantidades em **milhares** (1.000, 2.500, 5.000... até 1.000.000), mas o extrator devolveu 1, 10, 20, 50, 100, 500 — valores que não existem na página. Causa raiz: o prompt sugere "ex: 1un, 10un, 20un, 50un" e o modelo segue esse padrão em vez de ler a tabela real. Some-se a isso `onlyMainContent: true`, que pode estar cortando a tabela de preços do Atual Card (que fica numa coluna lateral).

## Solução

### 1. Reescrever prompt + schema para forçar fidelidade
- **Remover exemplos numéricos** do prompt (eles enviesam o LLM).
- Instruir explicitamente: "NÃO invente valores. Se não houver tabela visível, retorne `tiers: []`."
- Pedir para extrair também a **string bruta** de cada linha (campo `texto_original`) — usado para validação posterior.
- Exigir que `quantidade` e `preco_total` venham **exatamente como aparecem** (sem arredondar nem normalizar).

### 2. Buscar HTML completo, não só "main content"
- Trocar `onlyMainContent: true` → `false`. A tabela de tiers no Atual Card fica em bloco separado do conteúdo principal e está sendo descartada.
- Adicionar `waitFor: 2000` para sites com JS (Atual Card carrega tiers dinamicamente).

### 3. Pipeline de validação em 2 passos
Em vez de confiar 100% no JSON do LLM:

```text
Passo 1: scrape com formats: ['markdown', { type: 'json', ... }]
Passo 2: validar cada tier do JSON contra o markdown bruto:
         - quantidade existe no texto? (busca por "1.000" / "1000")
         - preco_total existe no texto? (busca por "93,00" / "93.00")
         Se NÃO existir → descarta o tier (alucinação)
```

Isso elimina valores inventados sem depender do LLM ser perfeito.

### 4. UI: mostrar aviso quando houver descarte
No `NovoSiteDialog` (aba "Tabela auto"):
- Se nenhum tier sobreviver à validação: erro claro "Não foi possível detectar tiers reais nesta URL — verifique se a página tem tabela de preços visível ou use a aba Planilha".
- Se alguns sobreviverem: badge "✓ X faixas validadas" ao lado do contador.

### 5. Mesma correção em `scheduled-sync-firecrawl`
A função de atualização periódica usa o mesmo padrão de extração — aplicar idênticas mudanças (prompt, `onlyMainContent: false`, validação contra markdown) para não corromper o histórico com valores fantasiosos.

## Arquivos afetados

- `supabase/functions/detect-price-tiers/index.ts` — novo prompt + validação cruzada com markdown
- `supabase/functions/scheduled-sync-firecrawl/index.ts` — mesma lógica de extração/validação
- `src/components/monitoramento/NovoSiteDialog.tsx` — mensagens de erro/aviso quando validação descarta tiers

## Limitação honesta

Se o site renderiza preços via JavaScript pesado e o Firecrawl não consegue capturar, mesmo com `waitFor`, a única alternativa segura será o usuário usar a aba **Planilha** (importar Excel/CSV) ou — futuramente — o robô Playwright na VPS. A validação por markdown garante que **não vamos salvar dados errados**, mesmo que isso signifique salvar zero tiers em alguns casos.
