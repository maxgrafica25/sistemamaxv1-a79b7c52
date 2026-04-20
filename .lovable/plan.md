
# Adicionar logs temporários de depuração no `scrapeAtualCard`

Vou preparar uma depuração focada só na Atual Card para mostrar exatamente o que o `/content` está retornando e por que a regex não está encontrando preço.

## Arquivo a ajustar

- `supabase/functions/scrape-prices/index.ts`

## Mudanças

### 1) Logar preview do HTML bruto retornado pelo `/content`
Dentro de `scrapeAtualCard`, logo após:

```ts
const html = await fetchRenderedHtml(url, token);
```

adicionar um log temporário com:
- tamanho total do HTML
- primeiros 3000 caracteres
- versão compactada opcional (`replace(/\s+/g, " ")`) para facilitar leitura nos logs

Exemplo de saída esperada:

```text
[atualcard debug html] url=... len=123456 preview=<html>...</html>
```

### 2) Logar a extração da quantidade da URL
Antes da busca de preço, registrar:
- `pathname`
- `qtyMatch?.[0]`
- `qtyMatch?.[1]`
- `qty` final parseado

Isso confirma se a parte da quantidade está correta.

### 3) Logar o resultado exato das regex atuais
Registrar separadamente:
- resultado cru de `html.match(...)` do dataLayer
- resultado cru de `html.match(...)` do `data-price`
- valor parseado de cada um

Exemplo:

```text
[atualcard debug regex] dlMatch=["...", "93.00"] dpMatch=["data-price=\"93.00\"", "93.00"] totalFromDataLayer=93 totalFromDataPrice=93
```

### 4) Logar pistas adicionais no HTML para achar o seletor real
Se as regex falharem, adicionar logs auxiliares com pequenas amostras quando existirem:
- primeira ocorrência de `"price"`
- primeira ocorrência de `"data-price"`
- primeira ocorrência de `"valor"`
- primeira ocorrência de `"preco"`
- primeira ocorrência de `"item_id"`
- primeira ocorrência de `"dataLayer"`

A ideia é capturar um trecho de contexto próximo ao match, por exemplo 200–400 caracteres ao redor da ocorrência, sem despejar o HTML inteiro.

### 5) Logar o motivo final do tier zerado
Antes do retorno final, registrar:
- `qty`
- `total`
- resultado de `finalizeTiers(...)`
- se falhou por regex não encontrada ou por validação do `finalizeTiers`

Assim fica claro se o problema é:
- HTML não contém preço
- regex errada
- preço vem em outro formato
- `finalizeTiers` descartou o dado

## O que não muda

- Nenhuma mudança no fluxo de ANS, Futura IM ou outros fornecedores.
- Nenhuma alteração em UI, banco ou `NovoSiteDialog`.
- A estratégia automática por domínio continua igual.

## Resultado esperado

Após clicar em “Testar scraping” para a URL da Atual Card, os logs da função vão mostrar:
- o começo real do HTML vindo do `/content`
- o resultado real das regex do `dataLayer` e `data-price`
- a quantidade detectada na URL
- o ponto exato em que o tier está sendo perdido

Com isso, na próxima iteração dá para ajustar a regex/seletor certo com base no HTML real e depois remover esses logs temporários.
