
## Por que não deu certo

O problema principal não foi o worker em si. O fluxo usado na tela foi o **tab “URL simples”**, e esse tab **não usa a arquitetura nova com Playwright**.

### Diagnóstico confirmado
1. Na captura, o tab ativo é **“URL simples”**.
2. Nesse tab, o botão **“Detectar preço”** chama a edge function **`auto-detect-price`**.
3. Pelo código atual:
   - `src/components/monitoramento/NovoSiteDialog.tsx` chama `auto-detect-price` no modo “URL simples”.
   - O worker/Playwright só entra no fluxo de **`detect-price-tiers`** usado em **“Tabela auto”**.
4. O request real falhou com:
   - `POST /functions/v1/auto-detect-price`
   - resposta `500`
   - erro: **`error reading a body from connection`**
5. Isso acontece porque `auto-detect-price` faz um `fetch(url)` direto e tenta ler `res.text()`, mas Atual Card/Imprima Rápido são sites problemáticos para esse modo simples.

Em resumo:

```text
Você usou: URL simples
Fluxo executado: auto-detect-price
Fluxo esperado para gráfica/PWA: detect-price-tiers -> worker Playwright
Resultado: o worker nem foi usado nesse teste
```

## O que corrigir

### 1) Corrigir o roteamento na UI
No `NovoSiteDialog`, quando a URL for de:
- `atualcard.com.br`
- `imprimarapido.com.br`

o modo **“URL simples”** não deve mais tentar `auto-detect-price`.

Em vez disso, o sistema deve:
- mostrar aviso claro: “Este fornecedor usa tabela dinâmica. Use Tabela auto.”
- ou redirecionar automaticamente para o fluxo de **`detect-price-tiers`**
- ou chamar internamente `detect-price-tiers` mesmo estando no tab simples

Recomendação: para esses domínios, **bloquear o modo simples** e orientar para **Tabela auto**.

### 2) Melhorar a UX para evitar erro operacional
Hoje a mensagem diz:
- “Edge Function returned a non-2xx status code — tente o modo Avançado.”

Isso induz ao caminho errado.

Trocar por algo como:
- “Esse fornecedor não funciona no modo URL simples. Use ‘Tabela auto’, que usa captura avançada.”

### 3) Deixar `auto-detect-price` mais resiliente
Mesmo não sendo o fluxo ideal para gráficas, a função deve ser endurecida:
- tratar erro de leitura do body sem explodir em 500 genérico
- retornar erro amigável com contexto
- manter CORS em todas as respostas
- se o domínio for PWA conhecido, retornar imediatamente:
  - `success: false`
  - erro orientando usar “Tabela auto”

### 4) Opcional: unificar os fluxos
Para reduzir confusão, o melhor desenho é:

```text
URL simples
  -> para e-commerce comum: auto-detect-price
  -> para Atual Card / Imprima Rápido: detect-price-tiers (worker)
```

Assim o usuário não precisa saber qual tab usar.

## Arquivos a ajustar

### `src/components/monitoramento/NovoSiteDialog.tsx`
- detectar domínio da URL no modo “URL simples”
- impedir chamada de `auto-detect-price` para domínios gráficos problemáticos
- exibir mensagem correta
- opcionalmente redirecionar/copiar a URL para o tab “Tabela auto”

### `supabase/functions/auto-detect-price/index.ts`
- adicionar guard clause para domínios `atualcard.com.br` e `imprimarapido.com.br`
- melhorar tratamento do `fetch` e leitura de body
- nunca devolver 500 genérico nesse caso; devolver erro guiado

### Opcional: `supabase/functions/detect-price-tiers/index.ts`
- manter como caminho oficial para esses fornecedores
- se necessário, reforçar logs/diagnóstico do worker

## Resultado esperado após a correção

- Se colar URL da Atual Card ou Imprima Rápido em **URL simples**, o sistema não quebra nem mostra erro genérico.
- O usuário é levado automaticamente ao fluxo correto.
- O worker Playwright passa a ser realmente usado para esses fornecedores.
- Some a falsa sensação de que “a integração não funcionou”, porque o app para de chamar a função errada.

## Implementação recomendada
1. Ajustar o `NovoSiteDialog` para detectar domínio e bloquear/redirecionar o modo simples.
2. Ajustar `auto-detect-price` para responder com erro guiado em vez de 500.
3. Refinar a copy da interface.
4. Testar:
   - Atual Card em “URL simples”
   - Imprima Rápido em “URL simples”
   - ANS/FuturaIM em “URL simples”
   - Atual Card/Imprima Rápido em “Tabela auto”

## Sem mudanças de banco
Essa correção é só de fluxo/UI + edge function.

