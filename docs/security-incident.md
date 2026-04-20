# Procedimento de resposta a incidente — vazamento de chave de serviço

Documento operacional: o que fazer **agora** se a `SUPABASE_SERVICE_ROLE_KEY` (ou qualquer secret crítico) for comprometida.

> **ID do projeto Lovable:** `667f8a1f-61e4-4274-8da0-fdacd8d61791`

---

## Fase 1 — Mitigação imediata (você consegue sozinho, ~5 minutos)

Objetivo: cortar o uso ativo da chave vazada antes da rotação oficial.

1. **Desabilitar edge functions que usam service role.**
   Cloud → Edge Functions → para cada uma da lista abaixo, alternar o switch para *desativada*:
   - `scrape-prices`
   - `scrape-prices-cron`
   - `sync-prices-webhook`
   - `check-reminders`
   - `monitor-admin-usage`

   Sem essas funções no ar, mesmo quem tem a key fica sem endpoints nossos para invocar — reduz drasticamente o blast radius enquanto a rotação não sai.

2. **Revogar todas as sessões ativas.**
   Cloud → Users → botão "Sign out all users". Força todo mundo a logar de novo (precaução caso a key tenha sido usada para emitir JWTs falsos).

3. **Rotacionar secrets que você controla diretamente.**
   Cloud → Secrets → editar valor de cada um:
   - `BROWSERLESS_API_KEY` (gerar nova em browserless.io → cole)
   - `FIRECRAWL_API_KEY` (via Connectors → Firecrawl → Reconnect)

   Motivo: quem tinha a service role poderia ter lido esses secrets via edge function antes de você desabilitá-las.

---

## Fase 2 — Em paralelo, escalar para suporte Lovable (rotação oficial)

A `SUPABASE_SERVICE_ROLE_KEY` em si só é rotacionada pela equipe Lovable. Antes de abrir chamado, conferir `https://status.lovable.dev/` — se há incidente plataforma-wide em andamento, mencionar no corpo do ticket pode acelerar contexto.

Abrir chamado por canais oficiais, em ordem de prioridade:

1. **Formulário oficial (canal primário)**
   - URL: `https://lovable.dev/support`
   - Esse é o caminho indicado pela [support policy](https://docs.lovable.dev/introduction/support-policy) oficial.
   - A primeira resposta é via AI. **No corpo do chamado, já pedir explicitamente**: `"Escalate to human — security incident — service role key compromise — project 667f8a1f-61e4-4274-8da0-fdacd8d61791"`.
   - Descrever: quando começou a suspeita, como foi descoberto, mitigação da Fase 1 já aplicada.

2. **Email (fallback)**
   - Para: `support@lovable.dev`
   - Usar apenas se o formulário estiver indisponível.
   - Mesmo assunto/corpo do item 1.

3. **Discord (complementar — community-only, sem garantia de resposta oficial)**
   - `https://discord.gg/lovable-dev`, canal `#support`.
   - Útil para visibilidade pública do incidente, **não substitui** o canal primário.

Aguardar confirmação de que a rotação foi feita e que `.env`/secrets do projeto foram atualizados.

### Tempo de resposta esperado

Lovable **não publica SLA numérico** para incidentes de segurança em nenhum plano (Free, Pro, Teams, Business, Enterprise). A [support policy](https://docs.lovable.dev/introduction/support-policy) oficial cobre "platform bugs" no escopo, mas **sem tempo de resposta garantido publicamente** exceto em contratos Enterprise (negociados caso a caso).

**Não documentamos um número fixo aqui** porque qualquer estimativa seria especulação e criaria falsa segurança. Em vez disso, calibre o SLA real do seu workspace antes de precisar (ver subseção abaixo).

### Calibração proativa do SLA real

Rodar **antes** de um incidente de verdade, para ter número realista baseado no comportamento real do suporte no plano atual:

1. Abrir chamado não-crítico (ex: "dúvida sobre limites do plano X") via formulário oficial.
2. Cronometrar: tempo até **primeira resposta humana** (não AI).
3. Repetir 2-3x em momentos diferentes (semana útil, fim de semana, feriado).
4. Anotar resultado na tabela ao final deste documento.
5. Usar a **média observada × 2** como estimativa realista para pior caso de incidente.

---

## Fase 3 — Pós-rotação: forensics e validação

Depois que a key nova estiver em uso:

1. **Auditar `admin_operations_log` no período suspeito.**
   No Cloud → Database → SQL Editor:
   ```sql
   SELECT created_at, function_name, operation, target_table, target_count, invoked_by, metadata
   FROM public.admin_operations_log
   WHERE created_at BETWEEN '<início_suspeita>' AND '<fim_rotacao>'
   ORDER BY created_at DESC;
   ```
   Procurar por: volumes anormais, `function_name` desconhecidos, `invoked_by IS NULL` em horários atípicos.

2. **Revisar inserções suspeitas em tabelas sensíveis:**
   ```sql
   SELECT id, criado_em, site_id, valor FROM public.historico_precos
   WHERE criado_em > '<início_suspeita>' ORDER BY criado_em DESC LIMIT 200;

   SELECT id, created_at, user_id, type, title FROM public.notifications
   WHERE created_at > '<início_suspeita>' ORDER BY created_at DESC LIMIT 200;

   SELECT id, created_at, user_id, channel_id, content FROM public.messages
   WHERE created_at > '<início_suspeita>' ORDER BY created_at DESC LIMIT 200;
   ```

3. **Reativar as edge functions** desabilitadas na Fase 1 (Cloud → Edge Functions → ligar switch).

4. **Verificar alerta automatizado**: `monitor-admin-usage` roda a cada 15min e cria notificação para admins se detectar pico ≥3x sobre baseline. Confirmar que está funcionando após reativar.

---

## Limites conhecidos do Lovable Cloud

- **Sem dashboard direto do Supabase**: rotação da service role exige suporte. Para autonomia total nesse aspecto, considerar migração para Supabase Connection (projeto Supabase próprio com login completo no dashboard).
- **Rate limiting**: backend ainda não tem primitivos adequados; mitigação por hora é via desativação manual das funções.
- **SLA de suporte**: varia por plano (Free/Pro/Business/Enterprise). Recomenda-se testar tempo de resposta em incidente não-crítico **antes** de precisar de verdade.

---

## Prevenção contínua

- Nunca commitar chaves no git nem colar em chat externo.
- Rodar `git log -p | grep -i 'eyJ'` periodicamente para detectar vazamentos acidentais.
- Revisar `admin_operations_log` mensalmente como auditoria de rotina.
- Manter `SUPABASE_SERVICE_ROLE_KEY` confinada às edge functions listadas na Fase 1 — nunca usar no frontend.
