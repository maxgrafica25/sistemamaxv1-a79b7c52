
# Corrigir conexão do Google Calendar no preview e no app publicado

## Diagnóstico confirmado

O `google-oauth-init` já está retornando a URL correta do Google com o callback correto:

```text
https://nxkmxslugblhsyohrrvm.supabase.co/functions/v1/google-oauth-callback
```

Então o problema principal não é mais o secret do redirect URI.

O erro atual acontece porque o botão **Conectar Google Calendar** usa:

```ts
window.location.href = data.url
```

Dentro do editor da Lovable isso navega o **iframe do preview**, não a janela principal. O OAuth do Google não se comporta bem nesse contexto embutido, por isso você continua caindo nessa tela 403.

Além disso, o callback hoje decide para onde voltar usando `referer` ou um fallback hardcoded para a URL de preview, o que é frágil e pode quebrar entre preview/publicado.

## O que vou ajustar

### 1. Fazer o OAuth sair do iframe
No `src/components/configuracoes/GoogleCalendarCard.tsx` vou trocar a navegação para um fluxo que:
- detecta se o app está rodando embutido;
- tenta abrir o Google fora do iframe (`_top` ou nova aba);
- mantém fallback seguro se estiver rodando standalone.

Objetivo: o clique em **Conectar Google Calendar** sempre abrir o Google no contexto correto.

### 2. Passar a origem do app no `state`
No `supabase/functions/google-oauth-init/index.ts` vou incluir no `state` assinado:
- `user_id`
- `ts`
- `app_origin`

Esse `app_origin` virá da origem real do app que iniciou o fluxo.

### 3. Remover a dependência de `referer` no callback
No `supabase/functions/google-oauth-callback/index.ts` vou:
- validar o `state`;
- ler `app_origin` do `state`;
- redirecionar de volta para essa origem exata em `/configuracoes?gcal=ok` ou `?gcal=error=...`.

Com isso:
- preview volta para o preview;
- publicado volta para o publicado;
- não fica preso a URL hardcoded;
- não depende do `referer` enviado pelo Google.

### 4. Preservar o fluxo atual de tokens
Não vou mexer em:
- tabela `user_google_tokens`
- `google-disconnect`
- `gcal-sync-worker`
- escopos atuais do Google

O OAuth próprio continua sendo o único fluxo oficial.

## Arquivos a alterar

- `src/components/configuracoes/GoogleCalendarCard.tsx`
- `supabase/functions/google-oauth-init/index.ts`
- `supabase/functions/google-oauth-callback/index.ts`

## Resultado esperado

Depois da correção:
1. clicar em **Conectar Google Calendar** abre o Google fora do iframe do editor;
2. concluir a autorização volta corretamente para a mesma origem do app;
3. o card em **Configurações → Integrações** mostra conexão ativa;
4. `user_google_tokens` continua sendo a fonte única da integração.

## Observação importante

A configuração no Google Cloud Console com este redirect URI continua necessária e deve permanecer assim:

```text
https://nxkmxslugblhsyohrrvm.supabase.co/functions/v1/google-oauth-callback
```

## Solução temporária até aplicar a correção

Enquanto isso não é implementado, o teste mais confiável é abrir o app fora do preview embutido (em aba própria / URL publicada), porque o erro atual é consistente com tentativa de OAuth dentro do iframe do editor.
