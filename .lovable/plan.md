

# Atualizar `docs/security-incident.md` com expectativa realista de SLA

## Contexto

A documentação oficial do Lovable (`docs.lovable.dev/introduction/support-policy`) **não publica tempo de resposta garantido** para nenhuma categoria de incidente, incluindo rotação de service role key. Não há SLA diferenciado por plano publicado. Inventar um número ("4 horas", "24 horas") na doc interna seria pior que não ter número — cria falsa segurança.

A abordagem correta: documentar o que é **fato verificável** + dar ao usuário um procedimento para **medir o SLA real** do próprio workspace antes do incidente acontecer.

## Mudanças no arquivo

Editar `docs/security-incident.md`, **Fase 2** (escalar para suporte) e seção final **Limites conhecidos**:

### Fase 2 — substituir o texto atual por versão com fatos da doc oficial

Hoje a fase 2 lista email + Discord. Adicionar:

- Link para o formulário oficial (`https://lovable.dev/support`) como canal **primário** — é o caminho que a doc indica.
- Esclarecer que email `support@lovable.dev` é fallback se o formulário estiver fora do ar.
- Mencionar que a primeira resposta é AI, com opção de escalar para humano — então no corpo do chamado já pedir explicitamente "escalate to human, security incident, service role key compromise".
- Discord (`discord.gg/lovable-dev`) é community-only, **sem garantia de resposta oficial** — usar como canal complementar para visibilidade, não como canal primário.
- Verificar `https://status.lovable.dev/` antes de abrir chamado: se há incidente plataforma-wide em andamento, pode acelerar contexto.

### Nova seção: "Tempo de resposta esperado"

Bloco curto e honesto:

> Lovable **não publica SLA numérico** para incidentes de segurança em nenhum plano (Free, Pro, Teams, Business, Enterprise). O escopo oficial cobre "platform bugs", mas sem tempo de resposta garantido publicamente.
>
> **Não documentamos um número aqui** porque qualquer estimativa seria especulação. Em vez disso, temos um procedimento de calibração:

### Nova subseção: "Calibração proativa do SLA real"

Procedimento de uma página para o usuário rodar **antes** de precisar de verdade:

1. Abrir um chamado não-crítico (ex: "dúvida sobre limites do plano X") via formulário oficial.
2. Cronometrar: tempo até primeira resposta humana (não AI).
3. Repetir 2-3x ao longo de semanas diferentes (semana, fim de semana, feriado).
4. Anotar resultado no fim do próprio `security-incident.md` numa tabela:

   ```
   | Data       | Plano   | Canal       | 1ª resposta humana |
   |------------|---------|-------------|--------------------|
   | YYYY-MM-DD | Pro     | Formulário  | XhYm               |
   ```

5. Usar a média observada como estimativa realista para o pior caso.

### Atualizar "Limites conhecidos" (final do arquivo)

Substituir a linha vaga "SLA de suporte: varia por plano" por:

> SLA de suporte: **não publicado oficialmente**. Lovable garante apenas que clientes pagantes têm acesso ao canal oficial; tempo de resposta não é contratual exceto em Enterprise (negociado caso a caso). Para autonomia total na rotação, única alternativa é migrar para Supabase Connection (ver decisão técnica em conversa anterior).

### Manter inalterado

Fases 1 (mitigação imediata que você faz sozinho) e 3 (forensics pós-rotação) continuam como estão — são o ponto forte do documento e independem do SLA do suporte.

## Resultado

- Doc não tem número fictício que dá falsa segurança.
- Usuário tem procedimento concreto para gerar seu próprio número, baseado no comportamento real do suporte no plano atual.
- Fica explícito que a única forma de **eliminar** essa incerteza é arquitetural (migrar para Supabase Connection), não procedural.
- Fontes citadas inline na doc para auditabilidade futura: `docs.lovable.dev/introduction/support-policy` e `status.lovable.dev`.

## Arquivos afetados

| Ação | Arquivo |
|------|---------|
| Editar | `docs/security-incident.md` (Fase 2 + nova seção SLA + nova subseção Calibração + Limites conhecidos) |

Sem mudanças de código ou banco. Documentação pura.

