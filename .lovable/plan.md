## Objetivo

Adicionar teste de RLS/regra de negócio que garanta que **o último admin do sistema não pode ser removido/rebaixado**, complementando a suíte `src/test/rls/` da Fase 1.

## Contexto

A auditoria mencionou existir (ou dever existir) uma proteção `prevent_last_admin_lockout` — tipicamente um trigger `BEFORE UPDATE/DELETE` em `profiles` (ou em `user_roles`) que bloqueia:
- DELETE do último perfil com `role='admin'`
- UPDATE que troque o `role` do último admin para outro valor

Antes de escrever o teste precisamos confirmar onde/como essa proteção está implementada (ou se ainda não existe — nesse caso o teste serve como spec).

## Passos

1. **Investigar a proteção existente**
   - Buscar no schema/funções: `prevent_last_admin`, `last_admin`, triggers em `profiles`.
   - Se existir: anotar nome do trigger, função, tabela alvo (`profiles` vs `user_roles`) e mensagem de erro.
   - Se NÃO existir: documentar no plano que a proteção precisa ser criada na Fase 1.5 (fora do escopo deste teste — o teste apenas valida o comportamento esperado e ficará marcado como `expected to fail` até a migration).

2. **Criar `src/test/rls/last_admin_lockout.test.ts`**
   Cenários cobertos (usando os 3 JWTs já definidos em `setup.ts`):

   - **Cenário A — DELETE do único admin é bloqueado**
     - Setup: garantir que existe apenas 1 admin (o JWT admin).
     - Ação: admin tenta `DELETE FROM profiles WHERE id = <self>`.
     - Esperado: erro contendo `last_admin` (ou similar) e linha permanece.

   - **Cenário B — UPDATE rebaixando o único admin é bloqueado**
     - Ação: admin tenta `UPDATE profiles SET role='colaborador' WHERE id = <self>`.
     - Esperado: erro do trigger; `role` permanece `admin`.

   - **Cenário C — Operação permitida quando há ≥2 admins**
     - Setup: promover um segundo usuário a admin (via JWT admin).
     - Ação: rebaixar o admin original.
     - Esperado: sucesso; contagem de admins ≥1 ao final.
     - Teardown: restaurar estado original (re-promover quem foi rebaixado, remover admin temporário).

   - **Cenário D — Colaborador não consegue rebaixar admin (sanity check de RLS já coberto, mas reforçado aqui)**
     - Esperado: erro de RLS, não do trigger.

3. **Guard de produção**
   - Reusar `assertNotProduction()` do `setup.ts`.
   - Adicionar `beforeAll` que conta admins iniciais e `afterAll` que valida que a contagem não diminuiu (defesa em profundidade contra teste mal escrito).

4. **Atualizar `docs/security-phase1/README.md`**
   - Acrescentar seção "Teste 5: last_admin_lockout".
   - Se a proteção ainda não existir, adicionar item à checklist da Fase 1: criar migration `05_prevent_last_admin_lockout.sql` + rollback, com trigger `BEFORE UPDATE OR DELETE ON profiles` chamando função `SECURITY DEFINER` que conta `WHERE role='admin'` e levanta exceção se a operação resultar em zero admins.

## Entregáveis

- `src/test/rls/last_admin_lockout.test.ts` (novo)
- `docs/security-phase1/README.md` (seção atualizada)
- Se proteção ausente: drafts `docs/security-phase1/05_prevent_last_admin_lockout.sql` + `_rollback.sql` (apenas rascunho para revisão, não aplicado)

## Fora de escopo

- Não aplicar nenhuma migration em produção.
- Não rodar os testes contra produção (guard já existente).
- Não alterar lógica de roles em outras tabelas (`user_roles` futura) — fica para Fase 2 caso seja decidida a migração para tabela dedicada.
